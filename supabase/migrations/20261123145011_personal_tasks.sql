create table public.personal_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) <= 160 and title ~ '[^[:space:]]'),
  status public.task_status not null default 'todo',
  created_at timestamptz not null default statement_timestamp()
);

create index personal_tasks_owner_created_idx on public.personal_tasks (owner_id, created_at desc, id);

alter table public.personal_tasks enable row level security;

create policy personal_tasks_read_own on public.personal_tasks for select to authenticated
  using (owner_id = (select auth.uid()));
create policy personal_tasks_insert_own on public.personal_tasks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy personal_tasks_update_own on public.personal_tasks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on public.personal_tasks from public, anon, authenticated;
grant select, insert (id, title), update (status) on public.personal_tasks to authenticated;
