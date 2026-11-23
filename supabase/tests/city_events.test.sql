begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

select has_table('public', 'city_events', 'the city has a persistent event feed');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
  and schemaname = 'public' and tablename = 'city_events'), 'committed events are published for the live feed');

insert into auth.users (id) values
  ('c1000000-0000-0000-0000-000000000001'), ('c1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000003'), ('c1000000-0000-0000-0000-000000000004');
update profiles set display_name = 'Town Planner' where id = 'c1000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';
do $$begin
  perform set_config('test_feed.city', create_city('Test city')::text, true);
  perform set_config('test_feed.invite', get_city_invite(current_setting('test_feed.city')::uuid)::text, true);
end$$;
select is_empty($$select id from city_events$$, 'creating a city does not claim its founder accepted an invite');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000002';
do $$begin
  perform join_city(current_setting('test_feed.invite')::uuid);
  perform join_city(current_setting('test_feed.invite')::uuid);
end$$;
select results_eq($$select kind::text, actor_name, task_title, size::text from city_events$$,
  $$values ('joined', 'Участник №2', null::text, null::text)$$,
  'joining twice yields one event with the seat fallback when the member has no display name');
update profiles set display_name = 'Builder' where id = auth.uid();

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';
do $$begin
  perform set_config('test_feed.house', create_team_task(current_setting('test_feed.city')::uuid,
    'Town house', 'M', date '2001-04-01', array['c1000000-0000-0000-0000-000000000002'::uuid])::text, true);
end$$;
select results_eq($$select kind::text, actor_name, task_title, size::text, previous_stage::text, repaired
  from city_events where task_title is not null$$,
  $$values ('foundation', 'Town Planner', 'Town house', 'M', null::text, false)$$,
  'creating a task records one foundation attributed to its actual creator');
select ok((select id is not null and occurred_at between transaction_timestamp() and clock_timestamp()
  from city_events where kind = 'foundation'), 'the foundation has an identity and the time of the real action');
select throws_ok($$insert into city_events default values$$, '42501', null, 'even a leader cannot insert a feed row');
select throws_ok($$update city_events set actor_name = 'Changed'$$, '42501', null, 'even a leader cannot edit events');
select throws_ok($$delete from city_events$$, '42501', null, 'even a leader cannot erase events');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000002';
do $$begin
  perform set_task_status(current_setting('test_feed.house')::uuid, 'todo');
  perform set_task_status(current_setting('test_feed.house')::uuid, 'in_progress');
  perform set_task_status(current_setting('test_feed.house')::uuid, 'in_progress');
  perform set_task_status(current_setting('test_feed.house')::uuid, 'done');
  perform set_task_status(current_setting('test_feed.house')::uuid, 'done');
end$$;
select results_eq($$select kind::text, previous_stage::text, actor_name, repaired
  from city_events where task_title = 'Town house' order by kind::text$$,
  $$values ('completed', 'construction', 'Builder', true), ('construction', 'foundation', 'Builder', false),
    ('foundation', null::text, 'Town Planner', false)$$,
  'a late completion records its repair and author just once even when all statuses are retried');

update profiles set display_name = 'New Name' where id = auth.uid();
reset role;
-- The stored event is a snapshot even if a future maintenance action renames a task.
update team_tasks set title = 'Renamed house' where id = current_setting('test_feed.house')::uuid;
set local role authenticated;
select is((select actor_name from city_events where task_title = 'Town house' and kind = 'completed'),
  'Builder', 'history preserves the former actor name and title');
do $$begin
  perform set_task_status(current_setting('test_feed.house')::uuid, 'in_progress');
  perform set_task_status(current_setting('test_feed.house')::uuid, 'todo');
end$$;
select results_eq($$select kind::text, previous_stage::text, actor_name, repaired from city_events
  where task_title = 'Renamed house' order by kind::text$$,
  $$values ('construction', 'complete', 'New Name', false), ('foundation', 'construction', 'New Name', false)$$,
  'moving backwards records the old stage and current actor without inventing a second task');

savepoint before_completion;
do $$begin perform set_task_status(current_setting('test_feed.house')::uuid, 'done'); end$$;
rollback to before_completion;
select is_empty($$select id from city_events where task_title = 'Renamed house' and kind = 'completed'$$,
  'rolling back a task change also rolls back its feed row');
insert into personal_tasks (title) values ('Private errand');
update personal_tasks set status = 'done' where title = 'Private errand';
select is((select count(*) from city_events), 6::bigint, 'creating and completing a personal task adds no city events');

-- Supply two precise closing instants to the ordinary status RPC. All clock fixtures roll back.
reset role;
set local time zone 'UTC';
create function pg_temp.fixture_closing_time() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and new.title in ('Midnight kiosk', 'Evening kiosk') then
    new.closed_at := case new.title when 'Midnight kiosk' then timestamptz '2026-11-20 21:00:00+00'
      else timestamptz '2026-11-20 20:59:59.999999+00' end;
  end if;
  return new;
end$$;
create trigger fixture_closing_time before update of status on team_tasks
  for each row execute function pg_temp.fixture_closing_time();
set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000001';
do $$declare name text; id uuid; begin
  foreach name in array array['Evening kiosk', 'Midnight kiosk'] loop
    id := create_team_task(current_setting('test_feed.city')::uuid, name, 'S', date '2026-11-20');
    perform set_task_status(id, 'done');
  end loop;
end$$;
select results_eq($$select task_title, size::text, previous_stage::text, repaired from city_events
  where kind = 'completed' and size = 'S' order by task_title$$,
  $$values ('Evening kiosk', 'S', 'foundation', false), ('Midnight kiosk', 'S', 'foundation', true)$$,
  'a direct completion repairs a kiosk only from midnight Moscow time, using its recorded closing instant');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000003';
do $$declare city uuid; begin
  city := create_city('Separate city');
  perform create_team_task(city, 'Another neighborhood', 'S', date '2099-01-01');
end$$;
select results_eq($$select task_title from city_events$$, $$values ('Another neighborhood'::text)$$,
  'a leader in a different city sees only the history of their own city');
select is_empty($$select id from city_events where city_id = current_setting('test_feed.city')::uuid$$,
  'knowing the other city identifier does not reveal its history');
select throws_ok($$select set_task_status(current_setting('test_feed.house')::uuid, 'done')$$,
  '42501', null, 'a non-member cannot trigger a change on the city task');

set local request.jwt.claim.sub = 'c1000000-0000-0000-0000-000000000004';
select is_empty($$select id from city_events$$, 'an account outside all cities sees no events');
do $$begin perform join_city(current_setting('test_feed.invite')::uuid); end$$;
reset role;
update city_members set role = 'guest' where city_id = current_setting('test_feed.city')::uuid and user_id = auth.uid();
set local role authenticated;
select is((select count(*) from city_events where task_title = 'Town house'), 3::bigint,
  'a guest entering later can read the earlier construction history');
select is_empty($$select id from city_events where task_title = 'Another neighborhood'$$,
  'guest access stops at the city boundary');
select throws_ok($$select set_task_status(current_setting('test_feed.house')::uuid, 'done')$$,
  '42501', null, 'guest cannot change the task to publish an event');
select is_empty($$select id from city_events where task_title = 'Renamed house' and kind = 'completed'$$,
  'denied actions leave no public event');
select throws_ok($$insert into city_events default values$$, '42501', null, 'guest cannot add feed rows directly');

set local role anon;
select throws_ok($$select id from city_events$$, '42501', null, 'signed-out viewers cannot read the feed');
select throws_ok($$insert into city_events default values$$, '42501', null, 'signed-out viewers cannot insert events');

select * from finish();
rollback;
