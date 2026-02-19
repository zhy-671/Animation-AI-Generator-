create extension if not exists "pgcrypto";

create table if not exists public.project_export_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  scene_id uuid not null,
  status text not null default 'preparing',
  progress integer not null default 0 check (progress between 0 and 100),
  include_subtitles boolean not null default false,
  subtitles jsonb,
  video_clips jsonb not null,
  video_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_export_tasks_user_idx
  on public.project_export_tasks (user_id);

create index if not exists project_export_tasks_scene_idx
  on public.project_export_tasks (scene_id);

create index if not exists project_export_tasks_project_idx
  on public.project_export_tasks (project_id);

alter table public.project_export_tasks enable row level security;

create policy "Users can insert their export tasks"
  on public.project_export_tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read their export tasks"
  on public.project_export_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their export tasks"
  on public.project_export_tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


