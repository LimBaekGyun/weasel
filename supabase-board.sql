create table if not exists public.board_posts (
  id bigint generated always as identity primary key,
  author text not null check (char_length(trim(author)) between 1 and 24),
  title text not null check (char_length(trim(title)) between 1 and 80),
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists board_posts_created_at_idx
  on public.board_posts (created_at desc);

create table if not exists public.board_admins (
  email text primary key,
  created_at timestamptz not null default now(),
  check (position('@' in email) > 1)
);

grant usage on schema public to anon, authenticated;
grant select, insert on table public.board_posts to anon, authenticated;
grant select on table public.board_admins to authenticated;
grant usage, select on sequence public.board_posts_id_seq to anon, authenticated;

alter table public.board_posts enable row level security;
alter table public.board_admins enable row level security;

drop policy if exists "Public can read board posts" on public.board_posts;
create policy "Public can read board posts"
on public.board_posts
for select
to anon, authenticated
using (true);

drop policy if exists "Public can insert board posts" on public.board_posts;
create policy "Public can insert board posts"
on public.board_posts
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can delete board posts" on public.board_posts;
create policy "Admins can delete board posts"
on public.board_posts
for delete
to authenticated
using (
  exists (
    select 1
    from public.board_admins admins
    where lower(admins.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Admins can read own admin row" on public.board_admins;
create policy "Admins can read own admin row"
on public.board_admins
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Run this once with the email address you will use to log in:
-- insert into public.board_admins (email)
-- values ('you@example.com')
-- on conflict (email) do nothing;
