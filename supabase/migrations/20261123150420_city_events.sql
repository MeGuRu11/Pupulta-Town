create type public.city_event_kind as enum ('joined', 'foundation', 'construction', 'completed');

create table public.city_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  occurred_at timestamptz not null default clock_timestamp(),
  kind public.city_event_kind not null,
  actor_name text not null,
  task_title text,
  size public.task_size,
  previous_stage public.object_stage,
  repaired boolean not null default false,
  check (
    (kind = 'joined' and task_title is null and size is null and previous_stage is null)
    or (kind <> 'joined' and task_title is not null and size is not null)
  ),
  check (not repaired or kind = 'completed')
);

create index city_events_history_idx on public.city_events (city_id, occurred_at desc, id desc);

alter table public.city_events enable row level security;
create policy city_events_read_members on public.city_events for select to authenticated
  using (private.city_role_for(city_id) is not null);
revoke all on public.city_events from public, anon, authenticated;
grant select on public.city_events to authenticated;

-- Store the name visible to the city at the time, including its seat-based fallback.
create function private.event_actor_name(p_city_id uuid, p_user_id uuid)
returns text language sql stable set search_path = ''
as $$
  select coalesce(nullif(btrim(profile.display_name), ''), 'Участник №' || member.seat)
  from public.city_members as member
  join public.profiles as profile on profile.id = member.user_id
  where member.city_id = p_city_id and member.user_id = p_user_id;
$$;

create function private.log_member_joined()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.city_events (city_id, kind, actor_name)
  values (new.city_id, 'joined', private.event_actor_name(new.city_id, new.user_id));
  return null;
end;
$$;

create trigger city_events_after_join after insert on public.city_members
for each row when (new.role <> 'leader') execute function private.log_member_joined();

create function private.log_building_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.stage = old.stage then
    return null;
  end if;

  -- The task and the building have already been updated by the same RPC. Inspect
  -- the overdue state immediately before closure by omitting the closed-at argument.
  insert into public.city_events (city_id, kind, actor_name, task_title, size, previous_stage, repaired)
  select new.city_id,
         case new.stage
           when 'foundation' then 'foundation'::public.city_event_kind
           when 'construction' then 'construction'::public.city_event_kind
           when 'complete' then 'completed'::public.city_event_kind
         end,
         coalesce(private.event_actor_name(new.city_id, (select auth.uid())), 'Система'),
         task.title, new.size, old.stage,
         new.stage = 'complete' and task.closed_at is not null
           and private.decay_stage(task.due_on, task.closed_at) <> 'none'
  from public.team_tasks as task where task.id = new.task_id;
  return null;
end;
$$;

create trigger city_events_after_building_change after insert or update of stage on public.city_objects
for each row execute function private.log_building_event();

revoke execute on function private.event_actor_name(uuid, uuid),
  private.log_member_joined(), private.log_building_event() from public, anon, authenticated;

alter publication supabase_realtime add table public.city_events;
