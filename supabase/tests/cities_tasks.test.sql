begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(125);

-- Schema and anonymous access.

select has_table('public', 'profiles', 'profiles exists');

select has_table('public', 'cities', 'cities exists');

select has_table('public', 'city_members', 'city_members exists');

select has_table('public', 'team_tasks', 'team_tasks exists');

select has_table('public', 'task_assignees', 'task_assignees exists');

select has_table('public', 'city_objects', 'city_objects exists');

select is((select count(*) from pg_catalog.pg_class as c
  join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relrowsecurity
    and c.relname in ('profiles', 'cities', 'city_members', 'team_tasks', 'task_assignees', 'city_objects')), 6::bigint, 'all six tables have row-level security enabled');

set local role anon;

select throws_ok($sql$select public.create_city('Anonymous city')$sql$, '42501', null, 'anon cannot create a city');

select throws_ok($sql$select public.join_city('f1000000-0000-0000-0000-000000000099')$sql$, '42501', null, 'anon cannot use invitations');

select throws_ok($sql$select public.get_city_invite('f1000000-0000-0000-0000-000000000099')$sql$, '42501', null, 'anon cannot read invitations');

select throws_ok($sql$select public.create_team_task('f1000000-0000-0000-0000-000000000099', 'Anonymous task', 'S', date '2026-11-06')$sql$, '42501', null, 'anon cannot create a task');

select throws_ok($sql$select public.set_task_status('f1000000-0000-0000-0000-000000000099', 'done')$sql$, '42501', null, 'anon cannot change task status');

select throws_ok($sql$select id from public.profiles$sql$, '42501', null, 'anon cannot read profiles');

select throws_ok($sql$select id from public.cities$sql$, '42501', null, 'anon cannot read cities');

select throws_ok($sql$select city_id from public.city_members$sql$, '42501', null, 'anon cannot read city_members');

select throws_ok($sql$select id from public.team_tasks$sql$, '42501', null, 'anon cannot read team_tasks');

select throws_ok($sql$select city_id from public.task_assignees$sql$, '42501', null, 'anon cannot read task_assignees');

select throws_ok($sql$select id from public.city_objects$sql$, '42501', null, 'anon cannot read city_objects');

set local role authenticated;
set local request.jwt.claim.sub = '';

select throws_ok($sql$select public.create_city('No subject city')$sql$, '42501', null, 'an authenticated role without a JWT subject cannot create a city');

-- Fixtures use synthetic auth users. City A has a leader, two members and a guest. City B is separate.
reset role;
insert into auth.users (id, email)
select ('f1000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'pupulta-db-test-' || i || '@example.invalid'
from generate_series(1, 23) as fixture(i);
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000001';

select lives_ok($sql$select set_config('pupulta_test.city_a', (public.create_city('North City'))::text, true)$sql$, 'authenticated user can create a city');

select is((select name from public.cities where id = current_setting('pupulta_test.city_a')::uuid), 'North City'::text, 'creator can read the city');

select is((select created_by from public.cities where id = current_setting('pupulta_test.city_a')::uuid), 'f1000000-0000-0000-0000-000000000001'::uuid, 'city records its creator');

select ok((select seed between 0 and 4294967295 from public.cities where id = current_setting('pupulta_test.city_a')::uuid), 'city seed fits the shared unsigned 32-bit range');

select is((select role::text from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000001'), 'leader'::text, 'creator becomes a leader');

select is((select count(*) from public.profiles where id = 'f1000000-0000-0000-0000-000000000001'), 1::bigint, 'auth user has a profile');

select lives_ok($sql$select set_config('pupulta_test.invite_a', (public.get_city_invite(current_setting('pupulta_test.city_a')::uuid))::text, true)$sql$, 'leader can obtain a usable invitation');

select throws_ok($sql$select invite_token from public.cities where id = current_setting('pupulta_test.city_a')::uuid$sql$, '42501', null, 'invite token is excluded from direct city reads even for the leader');

select throws_ok($sql$update public.cities set name = 'Tampered' where id = current_setting('pupulta_test.city_a')::uuid$sql$, '42501', null, 'leader cannot change the city via direct table writes');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000002';

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'valid invitation adds an authenticated member');

select is((select role::text from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000002'), 'member'::text, 'invited user becomes a member');

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'joining twice is idempotent');

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000002'), 1::bigint, 'joining twice leaves exactly one membership');

select throws_ok($sql$select public.join_city('f1000000-0000-0000-0000-000000000099')$sql$, '22023', null, 'invalid invitation is rejected');

select throws_ok($sql$select public.get_city_invite(current_setting('pupulta_test.city_a')::uuid)$sql$, '42501', null, 'member cannot obtain the invitation');

select throws_ok($sql$select invite_token from public.cities where id = current_setting('pupulta_test.city_a')::uuid$sql$, '42501', null, 'member cannot read invite token directly');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000003';

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'second team member can join');

reset role;
insert into public.city_members (city_id, user_id, role, seat)
values (current_setting('pupulta_test.city_a')::uuid, 'f1000000-0000-0000-0000-000000000004', 'guest', 4);
set local role authenticated;
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000004';

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'guest who already belongs to the city can open the invitation');

select is((select role::text from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000004'), 'guest'::text, 'invitation does not promote a guest');

select throws_ok($sql$select public.get_city_invite(current_setting('pupulta_test.city_a')::uuid)$sql$, '42501', null, 'guest cannot obtain the invitation');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000005';

select lives_ok($sql$select set_config('pupulta_test.city_b', (public.create_city('South City'))::text, true)$sql$, 'a different user can create an independent city');

select lives_ok($sql$select set_config('pupulta_test.task_b', (public.create_team_task(current_setting('pupulta_test.city_b')::uuid, 'South-only task', 'S', date '2026-11-06'))::text, true)$sql$, 'second city can create a task on its own grid');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000001';

-- Task creation and automatic placement.

select lives_ok($sql$select set_config('pupulta_test.task_a', (public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Build the house', 'M', date '2026-11-06', array['f1000000-0000-0000-0000-000000000002']::uuid[], 'Fixture description'))::text, true)$sql$, 'leader creates an assigned M task');

select is((select description from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'Fixture description'::text, 'leader-supplied description is stored');

select is((select due_on from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), date '2026-11-06', 'task deadline is stored as a calendar date');

select is((select status::text from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'todo'::text, 'new task starts in todo');

select is((select count(*) from public.task_assignees where task_id = current_setting('pupulta_test.task_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000002'), 1::bigint, 'creation records the correct assignment');

select is((select array[cell_x, cell_z] from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), array[4, 4], 'first object occupies the first buildable cell');

select is((select size::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'M'::text, 'object footprint follows the task size');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'foundation'::text, 'new task has a foundation');

select is((select rotation::integer from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 0, 'initial rotation is zero');

select lives_ok($sql$select set_config('pupulta_test.task_s', (public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Place a stand', 'S', date '2026-11-06', array['f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000003']::uuid[]))::text, true)$sql$, 'leader can assign an S task to multiple team members');

select is((select count(*) from public.task_assignees where task_id = current_setting('pupulta_test.task_s')::uuid), 2::bigint, 'multiple assignments persist');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'each successful task creation produces exactly one object');

select ok((select cell_x between 4 and 15 and cell_z between 4 and 15
    and not (cell_x between 4 and 7 and cell_z between 4 and 7)
  from public.city_objects where task_id = current_setting('pupulta_test.task_s')::uuid), 'S avoids the street and the full 4-by-4 M footprint');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Too large', 'L', date '2026-11-06')$sql$, '23514', null, 'first slice rejects L tasks');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Mixed valid and outsider assignees', 'S', date '2026-11-06', array['f1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000005']::uuid[])$sql$, '23514', null, 'leader cannot assign a task to someone from another city');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Guest assignment', 'S', date '2026-11-06', array['f1000000-0000-0000-0000-000000000004']::uuid[])$sql$, '23514', null, 'leader cannot assign a task to a guest');

select is((select count(*) from public.team_tasks where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'failed creation leaves no partial task');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'failed creation leaves no partial object');

select is((select count(*) from public.task_assignees where city_id = current_setting('pupulta_test.city_a')::uuid), 3::bigint, 'failed creation leaves no partial assignments');

select throws_ok($sql$insert into public.city_objects (task_id, city_id, size, cell_x, cell_z)
values (current_setting('pupulta_test.task_a')::uuid, current_setting('pupulta_test.city_a')::uuid, 'M', 8, 8)$sql$, '42501', null, 'even a leader cannot insert objects directly');

select throws_ok($sql$update public.city_objects set rotation = 90 where task_id = current_setting('pupulta_test.task_a')::uuid$sql$, '42501', null, 'even a leader cannot update objects directly');

select throws_ok($sql$update public.team_tasks set status = 'done' where id = current_setting('pupulta_test.task_a')::uuid$sql$, '42501', null, 'even a leader changes task status through the RPC');

select throws_ok($sql$insert into public.task_assignees (task_id, city_id, user_id) values (current_setting('pupulta_test.task_a')::uuid, current_setting('pupulta_test.city_a')::uuid, 'f1000000-0000-0000-0000-000000000003')$sql$, '42501', null, 'leader cannot bypass the assignment RPC');

select throws_ok($sql$update public.city_members set role = 'leader' where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000002'$sql$, '42501', null, 'leader cannot bypass the membership RPC');

-- RLS isolates all city data and profile visibility.

select is((select count(*) from public.cities where id = current_setting('pupulta_test.city_b')::uuid), 0::bigint, 'leader of city A cannot read city B');

select is((select count(*) from public.team_tasks where city_id = current_setting('pupulta_test.city_b')::uuid), 0::bigint, 'leader of city A cannot read city B tasks');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_b')::uuid), 0::bigint, 'leader of city A cannot read city B objects');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000002';

select is((select count(*) from public.team_tasks where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'member can read their city''s tasks');

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid), 4::bigint, 'member can read their city''s membership');

select is((select count(*) from public.task_assignees where city_id = current_setting('pupulta_test.city_a')::uuid), 3::bigint, 'member can read their city''s assignments');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'member can read their city''s objects');

select is((select count(*) from public.profiles where id = 'f1000000-0000-0000-0000-000000000001'), 1::bigint, 'member can read a city neighbor''s profile');

select is((select count(*) from public.profiles where id = 'f1000000-0000-0000-0000-000000000005'), 0::bigint, 'member cannot read an unrelated user''s profile');

select lives_ok($sql$update public.profiles set display_name = 'Updated member', avatar = '{"hat":"blue"}'::jsonb where id = 'f1000000-0000-0000-0000-000000000002'$sql$, 'user can update their own profile');

select is((select display_name from public.profiles where id = 'f1000000-0000-0000-0000-000000000002'), 'Updated member'::text, 'authorized profile update persists');

select is((select avatar from public.profiles where id = 'f1000000-0000-0000-0000-000000000002'), '{"hat":"blue"}'::jsonb, 'authorized avatar update persists');

with denied as (
  update public.profiles set display_name = 'Tampered' where id = 'f1000000-0000-0000-0000-000000000001' returning id
)

select is((select count(*) from denied), 0::bigint, 'user cannot update a city neighbor''s profile');

select throws_ok($sql$update public.profiles set id = 'f1000000-0000-0000-0000-000000000009' where id = 'f1000000-0000-0000-0000-000000000002'$sql$, '42501', null, 'profile identity is not writable');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Member cannot create', 'S', date '2026-11-06')$sql$, '42501', null, 'ordinary member cannot create a task');

select throws_ok($sql$update public.team_tasks set title = 'Tampered' where id = current_setting('pupulta_test.task_a')::uuid$sql$, '42501', null, 'assigned member cannot change other task fields');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000004';

select is((select count(*) from public.team_tasks where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'guest can read the city''s tasks');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_a')::uuid), 2::bigint, 'guest can read the city''s objects');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Guest cannot create', 'S', date '2026-11-06')$sql$, '42501', null, 'guest cannot create a task');

select throws_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'in_progress')$sql$, '42501', null, 'guest cannot change task status');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000005';

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid), 0::bigint, 'outsider cannot read city A city_members');

select is((select count(*) from public.team_tasks where city_id = current_setting('pupulta_test.city_a')::uuid), 0::bigint, 'outsider cannot read city A team_tasks');

select is((select count(*) from public.task_assignees where city_id = current_setting('pupulta_test.city_a')::uuid), 0::bigint, 'outsider cannot read city A task_assignees');

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_a')::uuid), 0::bigint, 'outsider cannot read city A city_objects');

select is((select count(*) from public.cities where id = current_setting('pupulta_test.city_a')::uuid), 0::bigint, 'outsider cannot read city A');

select is((select count(*) from public.profiles where id = 'f1000000-0000-0000-0000-000000000001'), 0::bigint, 'outsider cannot read city A profiles');

select throws_ok($sql$select public.get_city_invite(current_setting('pupulta_test.city_a')::uuid)$sql$, '42501', null, 'outsider cannot obtain city A invitation');

select throws_ok($sql$select public.create_team_task(current_setting('pupulta_test.city_a')::uuid, 'Cross-city task', 'S', date '2026-11-06')$sql$, '42501', null, 'leader of another city cannot create a task here');

select throws_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'done')$sql$, '42501', null, 'leader of another city cannot change task status');

-- Status changes update only the authorized task and its object.
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000003';

select throws_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'done')$sql$, '42501', null, 'unassigned member cannot change another task');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000002';

select lives_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'in_progress')$sql$, 'assigned member can start the task');

select is((select status::text from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'in_progress'::text, 'task status changes to in progress');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'construction'::text, 'starting a task switches its object to construction');

select ok((select closed_at is null from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'starting a task does not set a closing timestamp');

select lives_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'done')$sql$, 'assigned member can close the task');

select is((select status::text from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'done'::text, 'closing changes the task status');

select ok((select closed_at is not null from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'closing records a timestamp');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'complete'::text, 'closing finishes construction');

-- Keep the persisted time distinct from any transaction or statement clock.
reset role;
select lives_ok($sql$update public.team_tasks set closed_at = timestamptz '2026-11-05 12:00:00+00'
  where id = current_setting('pupulta_test.task_a')::uuid$sql$, 'seed a previously closed task');
set local role authenticated;

select lives_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'done')$sql$, 'repeated close succeeds');

select is((select closed_at from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), timestamptz '2026-11-05 12:00:00+00', 'repeated close preserves the original timestamp');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_s')::uuid), 'foundation'::text, 'status changes do not alter another object''s stage');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000001';

select lives_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'in_progress')$sql$, 'leader can reopen a task assigned to another user');

select ok((select closed_at is null from public.team_tasks where id = current_setting('pupulta_test.task_a')::uuid), 'reopening clears the closing timestamp');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'construction'::text, 'reopening follows the requested construction stage');

select lives_ok($sql$select public.set_task_status(current_setting('pupulta_test.task_a')::uuid, 'done')$sql$, 'leader can close a task assigned to another user');

select is((select stage::text from public.city_objects where task_id = current_setting('pupulta_test.task_a')::uuid), 'complete'::text, 'leader''s close finishes the object');

-- Placement grows past the first block and the database rejects invalid coordinates.
set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000005';

do $$
begin
  for i in 1..10 loop
    perform public.create_team_task(current_setting('pupulta_test.city_b')::uuid, 'Extra house ' || i, 'M', date '2026-11-06');
  end loop;
end
$$;

select is((select count(*) from public.city_objects where city_id = current_setting('pupulta_test.city_b')::uuid and size = 'M'), 10::bigint, 'all ten houses fit as the city expands');

select ok((select exists (
  select 1 from public.city_objects
  where city_id = current_setting('pupulta_test.city_b')::uuid and (cell_x >= 16 or cell_z >= 16)
)), 'placement expands beyond the first 12-by-12 block');

select ok((select not exists (
  select 1 from public.city_objects as a
  join public.city_objects as b on a.city_id = b.city_id and a.id < b.id
  where int4range(a.cell_x, a.cell_x + case when a.size = 'M' then 4 else 1 end)
    && int4range(b.cell_x, b.cell_x + case when b.size = 'M' then 4 else 1 end)
    and int4range(a.cell_z, a.cell_z + case when a.size = 'M' then 4 else 1 end)
    && int4range(b.cell_z, b.cell_z + case when b.size = 'M' then 4 else 1 end)
)), 'no object footprints overlap in the expanded city');

reset role;

select throws_ok($sql$update public.city_objects set cell_x = 0 where task_id = current_setting('pupulta_test.task_s')::uuid$sql$, '23514', null, 'database rejects a street anchor even for a trusted writer');

select throws_ok($sql$update public.city_objects set cell_x = 14 where task_id = current_setting('pupulta_test.task_a')::uuid$sql$, '23514', null, 'database rejects an M footprint crossing a street from a buildable anchor');

select throws_ok($sql$update public.city_objects set cell_x = 5, cell_z = 5 where task_id = current_setting('pupulta_test.task_s')::uuid$sql$, '23P01', null, 'database rejects overlap even with different anchor cells');

-- The city limit includes all roles and retries remain idempotent.
set local role authenticated;
do $$
begin
  for i in 7..21 loop
    perform set_config('request.jwt.claim.sub',
      'f1000000-0000-0000-0000-' || lpad(i::text, 12, '0'), true);
    perform public.join_city(current_setting('pupulta_test.invite_a')::uuid);
  end loop;
end
$$;

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid), 19::bigint, 'fixtures leave one membership slot open');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000022';

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'the twentieth participant can join');

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid), 20::bigint, 'city has exactly twenty memberships');

select is((select public.join_city(current_setting('pupulta_test.invite_a')::uuid)), current_setting('pupulta_test.city_a')::uuid, 'existing member can reopen the invitation in a full city');

set local request.jwt.claim.sub = 'f1000000-0000-0000-0000-000000000023';

select throws_ok($sql$select public.join_city(current_setting('pupulta_test.invite_a')::uuid)$sql$, '23514', null, 'the twenty-first participant is rejected');

reset role;

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid), 20::bigint, 'failed join leaves the city at its membership limit');

select is((select count(*) from public.city_members where city_id = current_setting('pupulta_test.city_a')::uuid and user_id = 'f1000000-0000-0000-0000-000000000023'), 0::bigint, 'failed join creates no membership');

select * from finish();
rollback;
