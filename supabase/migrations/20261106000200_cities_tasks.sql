create extension if not exists btree_gist with schema extensions;

create type public.city_role as enum ('leader', 'member', 'guest');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.object_stage as enum ('foundation', 'construction', 'complete');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar jsonb not null default '{}'::jsonb check (jsonb_typeof(avatar) = 'object')
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  seed bigint not null default floor(random() * 4294967296)::bigint
    check (seed between 0 and 4294967295),
  created_by uuid not null references public.profiles(id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default statement_timestamp()
);

create index cities_created_by_idx on public.cities (created_by);

create table public.city_members (
  city_id uuid not null references public.cities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.city_role not null,
  seat smallint not null check (seat between 1 and 20),
  primary key (city_id, user_id),
  unique (city_id, seat)
);

create index city_members_user_id_idx on public.city_members (user_id, city_id);

create table public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  size public.task_size not null check (size in ('S', 'M')),
  due_on date not null check (due_on between date '0100-01-01' and date '9999-12-31'),
  status public.task_status not null default 'todo',
  closed_at timestamptz,
  check ((status = 'done') = (closed_at is not null)),
  unique (city_id, id),
  unique (city_id, id, size)
);

create table public.task_assignees (
  task_id uuid not null,
  city_id uuid not null,
  user_id uuid not null,
  primary key (task_id, user_id),
  foreign key (city_id, task_id) references public.team_tasks(city_id, id) on delete cascade,
  foreign key (city_id, user_id) references public.city_members(city_id, user_id) on delete cascade
);

create index task_assignees_city_id_idx on public.task_assignees (city_id, user_id);

create table public.city_objects (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique,
  city_id uuid not null,
  size public.task_size not null,
  cell_x integer not null,
  cell_z integer not null,
  rotation smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  stage public.object_stage not null default 'foundation',
  foreign key (city_id, task_id, size) references public.team_tasks(city_id, id, size) on delete cascade,
  check (private.fits_lot(cell_x, cell_z, size)),
  constraint city_objects_no_overlap exclude using gist (
    city_id with =,
    (int8range(cell_x::bigint, cell_x::bigint + private.footprint(size), '[)')) with &&,
    (int8range(cell_z::bigint, cell_z::bigint + private.footprint(size), '[)')) with &&
  )
);

create function private.create_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger pupulta_profile_after_signup
  after insert on auth.users
  for each row execute function private.create_profile();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- These helpers run as the table owner so policies on membership do not recurse.
create function private.city_role_for(p_city_id uuid)
returns public.city_role
language sql stable security definer set search_path = ''
as $$
  select role
  from public.city_members
  where city_id = p_city_id and user_id = (select auth.uid());
$$;

create function private.shares_city(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.city_members as viewer
    join public.city_members as neighbor on neighbor.city_id = viewer.city_id
    where viewer.user_id = (select auth.uid()) and neighbor.user_id = p_user_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.city_members enable row level security;
alter table public.team_tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.city_objects enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_city(id));

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy cities_read_members on public.cities for select to authenticated
  using (private.city_role_for(id) is not null);

create policy city_members_read_members on public.city_members for select to authenticated
  using (private.city_role_for(city_id) is not null);

create policy team_tasks_read_members on public.team_tasks for select to authenticated
  using (private.city_role_for(city_id) is not null);

create policy task_assignees_read_members on public.task_assignees for select to authenticated
  using (private.city_role_for(city_id) is not null);

create policy city_objects_read_members on public.city_objects for select to authenticated
  using (private.city_role_for(city_id) is not null);

revoke all on public.profiles, public.cities, public.city_members, public.team_tasks,
  public.task_assignees, public.city_objects from public, anon, authenticated;
grant select on public.profiles, public.city_members, public.team_tasks, public.task_assignees,
  public.city_objects to authenticated;
grant update (display_name, avatar) on public.profiles to authenticated;
grant select (id, name, seed, created_by, created_at) on public.cities to authenticated;

create function public.create_city(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_city_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.cities (name, created_by)
  values (btrim(p_name), v_user_id)
  returning id into v_city_id;

  insert into public.city_members (city_id, user_id, role, seat)
  values (v_city_id, v_user_id, 'leader', 1);

  return v_city_id;
end;
$$;

create function public.get_city_invite(p_city_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.city_role_for(p_city_id) is distinct from 'leader' then
    raise exception 'Only the city leader can read the invitation' using errcode = '42501';
  end if;

  return (select invite_token from public.cities where id = p_city_id);
end;
$$;

create function public.join_city(p_invite_token uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_city_id uuid;
  v_seat smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serialize admissions to this city before checking for an available seat.
  select id into v_city_id
  from public.cities where invite_token = p_invite_token for update;

  if not found then
    raise exception 'Invalid city invitation' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.city_members where city_id = v_city_id and user_id = v_user_id
  ) then
    return v_city_id;
  end if;

  select candidate.seat into v_seat
  from generate_series(1, 20) as candidate(seat)
  where not exists (
    select 1 from public.city_members where city_id = v_city_id and seat = candidate.seat
  )
  order by candidate.seat
  limit 1;

  if v_seat is null then
    raise exception 'City already has 20 participants' using errcode = '23514';
  end if;

  insert into public.city_members (city_id, user_id, role, seat)
  values (v_city_id, v_user_id, 'member', v_seat);
  return v_city_id;
end;
$$;

create function private.first_free_cell(p_city_id uuid, p_size public.task_size)
returns table (cell_x integer, cell_z integer)
language plpgsql set search_path = ''
as $$
declare
  v_radius integer := 0;
  v_period integer := private.grid_period();
  v_street integer := private.street_cells();
  v_side integer := private.footprint(p_size);
begin
  loop
    -- Visit each new square ring of blocks, then cells within a block in row order.
    return query
    select candidate.x, candidate.z
    from generate_series(0, v_radius) as bz(i)
    cross join generate_series(0, v_radius) as bx(i)
    cross join generate_series(v_street, v_period - v_side) as lz(i)
    cross join generate_series(v_street, v_period - v_side) as lx(i)
    cross join lateral (select bx.i * v_period + lx.i, bz.i * v_period + lz.i) as candidate(x, z)
    where (bz.i = v_radius or bx.i = v_radius)
      and not exists (
        select 1 from public.city_objects as occupied
        where occupied.city_id = p_city_id
          and int8range(occupied.cell_x::bigint, occupied.cell_x::bigint + private.footprint(occupied.size), '[)')
            && int8range(candidate.x::bigint, candidate.x::bigint + v_side, '[)')
          and int8range(occupied.cell_z::bigint, occupied.cell_z::bigint + private.footprint(occupied.size), '[)')
            && int8range(candidate.z::bigint, candidate.z::bigint + v_side, '[)')
      )
    order by bz.i, bx.i, lz.i, lx.i
    limit 1;
    if found then return; end if;
    v_radius := v_radius + 1;
  end loop;
end;
$$;

create function public.create_team_task(
  p_city_id uuid,
  p_title text,
  p_size public.task_size,
  p_due_on date,
  p_assignee_ids uuid[] default '{}',
  p_description text default ''
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_task_id uuid;
  v_cell_x integer;
  v_cell_z integer;
begin
  if private.city_role_for(p_city_id) is distinct from 'leader' then
    raise exception 'Only the city leader can create a task' using errcode = '42501';
  end if;

  if p_size is null or p_size not in ('S', 'M') then
    raise exception 'Only sizes S and M are supported in the first slice' using errcode = '23514';
  end if;

  -- Serialize placements within the city. The exclusion constraint also covers direct writes.
  perform 1 from public.cities where id = p_city_id for update;

  if exists (
    select 1 from unnest(p_assignee_ids) as assignee(user_id)
    where not exists (
      select 1 from public.city_members as member
      where member.city_id = p_city_id and member.user_id = assignee.user_id
        and member.role in ('leader', 'member')
    )
  ) then
    raise exception 'Assignees must be working members of the city' using errcode = '23514';
  end if;

  insert into public.team_tasks (city_id, title, description, size, due_on)
  values (p_city_id, btrim(p_title), coalesce(p_description, ''), p_size, p_due_on)
  returning id into v_task_id;

  insert into public.task_assignees (task_id, city_id, user_id)
  select distinct v_task_id, p_city_id, assignee.user_id from unnest(p_assignee_ids) as assignee(user_id);

  select cell_x, cell_z into v_cell_x, v_cell_z
  from private.first_free_cell(p_city_id, p_size);

  insert into public.city_objects (task_id, city_id, size, cell_x, cell_z)
  values (v_task_id, p_city_id, p_size, v_cell_x, v_cell_z);

  return v_task_id;
end;
$$;

create function public.set_task_status(p_task_id uuid, p_status public.task_status)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.team_tasks as task
  set status = p_status,
      closed_at = case when p_status = 'done' then coalesce(task.closed_at, statement_timestamp()) end
  where task.id = p_task_id
    and (
      private.city_role_for(task.city_id) = 'leader'
      or (
        private.city_role_for(task.city_id) = 'member'
        and exists (
          select 1 from public.task_assignees
          where task_id = task.id and user_id = (select auth.uid())
        )
      )
    );

  if not found then
    raise exception 'Only the city leader or an assigned member can change status' using errcode = '42501';
  end if;

  update public.city_objects
  set stage = case p_status
    when 'todo' then 'foundation'::public.object_stage
    when 'in_progress' then 'construction'::public.object_stage
    when 'done' then 'complete'::public.object_stage
  end
  where task_id = p_task_id;
end;
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.city_role_for(uuid), private.shares_city(uuid) to authenticated;

revoke execute on function public.create_city(text), public.get_city_invite(uuid),
  public.join_city(uuid), public.create_team_task(uuid, text, public.task_size, date, uuid[], text),
  public.set_task_status(uuid, public.task_status) from public, anon, authenticated;
grant execute on function public.create_city(text), public.get_city_invite(uuid),
  public.join_city(uuid), public.create_team_task(uuid, text, public.task_size, date, uuid[], text),
  public.set_task_status(uuid, public.task_status) to authenticated;

alter publication supabase_realtime add table public.team_tasks, public.city_objects;
