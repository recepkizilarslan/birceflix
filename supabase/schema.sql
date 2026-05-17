-- Run this once in your Supabase project (SQL Editor).
-- Creates watched_movies table + Row Level Security so users only see/edit their own rows.

create table if not exists public.watched_movies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tmdb_id      integer not null,
  imdb_id      text,
  title        text not null,
  poster_path  text,
  watched_at   timestamptz not null default now(),
  my_rating    smallint check (my_rating between 1 and 10),
  notes        text,
  unique (user_id, tmdb_id)
);

create index if not exists watched_movies_user_idx on public.watched_movies (user_id, watched_at desc);

alter table public.watched_movies enable row level security;

drop policy if exists "watched_movies_select_own" on public.watched_movies;
create policy "watched_movies_select_own"
  on public.watched_movies for select
  using (auth.uid() = user_id);

drop policy if exists "watched_movies_insert_own" on public.watched_movies;
create policy "watched_movies_insert_own"
  on public.watched_movies for insert
  with check (auth.uid() = user_id);

drop policy if exists "watched_movies_update_own" on public.watched_movies;
create policy "watched_movies_update_own"
  on public.watched_movies for update
  using (auth.uid() = user_id);

drop policy if exists "watched_movies_delete_own" on public.watched_movies;
create policy "watched_movies_delete_own"
  on public.watched_movies for delete
  using (auth.uid() = user_id);
