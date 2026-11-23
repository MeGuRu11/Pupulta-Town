begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into auth.users (id) values
  ('b1000000-0000-0000-0000-000000000001'),
  ('b1000000-0000-0000-0000-000000000002');

select has_table('public', 'personal_tasks', 'personal tasks exist');
set local role anon;
select throws_ok($$select * from personal_tasks$$, '42501', null, 'anonymous reads denied');
select throws_ok($$insert into personal_tasks(title) values ('A note')$$, '42501', null, 'anonymous creation denied');
select throws_ok($$update personal_tasks set status = 'done'$$, '42501', null, 'anonymous status changes denied');

set local role authenticated;
set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
select lives_ok($$insert into personal_tasks(id, title)
  values ('b2000000-0000-0000-0000-000000000001', 'Read a chapter')$$,
  'a user without a city can create a task with a client-generated ID');
select is((select owner_id from personal_tasks), auth.uid(), 'owner comes from the session');
select is((select status::text from personal_tasks), 'todo', 'new task starts as todo');
select throws_ok($$insert into personal_tasks(title) values (E' \t\n')$$, '23514', null, 'whitespace title rejected');
select throws_ok($$insert into personal_tasks(title) values (repeat('a', 161))$$, '23514', null, 'too long title rejected');
select lives_ok($$insert into personal_tasks(title) values (repeat('я', 160))$$, '160 characters and a generated ID accepted');
select throws_ok($$insert into personal_tasks(title,owner_id)
  values ('Another owner','b1000000-0000-0000-0000-000000000002')$$, '42501', null, 'cannot assign a task to someone else');
select throws_ok($$insert into personal_tasks(title,status) values ('Precompleted','done')$$,
  '42501', null, 'cannot set the initial status');
select throws_ok($$update personal_tasks set owner_id = 'b1000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'owner cannot be transferred');
select throws_ok($$update personal_tasks set title = 'Another title'$$, '42501', null, 'only the status can be updated');
select throws_ok($$update personal_tasks set created_at = now()$$, '42501', null, 'timestamps are server-controlled');
select throws_ok($$delete from personal_tasks$$, '42501', null, 'client cannot delete tasks');

-- The first user is an ordinary member of the second user's city.
set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000002';
do $$
begin
  perform set_config('pupulta_test.personal_city', public.create_city('Task City')::text, true);
  perform set_config('pupulta_test.personal_invite', public.get_city_invite(current_setting('pupulta_test.personal_city')::uuid)::text, true);
end;
$$;
set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
do $$begin perform public.join_city(current_setting('pupulta_test.personal_invite')::uuid); end;$$;
update personal_tasks set status = 'done' where id = 'b2000000-0000-0000-0000-000000000001';
select is((select status::text from personal_tasks where id = 'b2000000-0000-0000-0000-000000000001'),
  'done', 'the owner can complete a task after joining a city');
select is_empty($$select id from city_objects$$, 'personal progress creates no city objects');
select is_empty($$select id from team_tasks$$, 'personal tasks stay outside the team tracker');

set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000002';
select is_empty($$select id from personal_tasks$$, 'a city leader cannot see tasks of another member');
select is_empty($$update personal_tasks set status = 'todo' where id = 'b2000000-0000-0000-0000-000000000001'
  returning id$$, 'a leader cannot change the status of a known member task');
insert into personal_tasks(title) values ('Call the library');
select results_eq($$select title from personal_tasks$$, $$values ('Call the library'::text)$$,
  'the leader sees only their own task');

set local request.jwt.claim.sub = 'b1000000-0000-0000-0000-000000000001';
select is((select status::text from personal_tasks where id = 'b2000000-0000-0000-0000-000000000001'),
  'done', 'foreign update left the status unchanged');
update personal_tasks set status = 'in_progress' where id = 'b2000000-0000-0000-0000-000000000001';
select is((select status::text from personal_tasks where id = 'b2000000-0000-0000-0000-000000000001'),
  'in_progress', 'the owner can reopen their completed task');

select * from finish();
rollback;
