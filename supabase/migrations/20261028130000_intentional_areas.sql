-- Intentions: life areas (Me, Marriage, Checkit, …) that every card belongs to, with weekly time targets.
create table if not exists public.intentional_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '•',
  statement text,
  weekly_minutes int check (weekly_minutes is null or weekly_minutes > 0),
  -- when this area usually deserves attention: work hours, personal time, or anytime
  focus text not null default 'any' check (focus in ('work', 'personal', 'any')),
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists intentional_areas_user_idx on public.intentional_areas (user_id);

alter table public.intentional_areas enable row level security;
create policy "own areas" on public.intentional_areas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.intentional_cards
  add column if not exists area_id uuid references public.intentional_areas(id) on delete set null;

alter table public.intentional_time_logs
  add column if not exists area_id uuid references public.intentional_areas(id) on delete set null;
