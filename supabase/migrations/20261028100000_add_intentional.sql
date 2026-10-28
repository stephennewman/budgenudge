-- Intentional: card-based capture (transcripts → cards), priorities, daily habits, time logs.

create table if not exists public.intentional_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.intentional_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'action'
    check (kind in ('action', 'thought', 'idea', 'reminder', 'note', 'habit', 'principle')),
  title text not null,
  body text,
  est_minutes int check (est_minutes is null or est_minutes > 0),
  stars int not null default 3 check (stars between 1 and 5),
  prioritized boolean not null default false,
  status text not null default 'open' check (status in ('open', 'done', 'archived')),
  due_date date,
  related_ids uuid[] not null default '{}',
  transcript_id uuid references public.intentional_transcripts(id) on delete set null,
  -- habits stay open; this marks the last local day they were done
  last_done_on date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists intentional_cards_user_status_idx
  on public.intentional_cards (user_id, status);

create table if not exists public.intentional_time_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references public.intentional_cards(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  seconds int not null check (seconds >= 0)
);

create index if not exists intentional_time_logs_user_ended_idx
  on public.intentional_time_logs (user_id, ended_at);

alter table public.intentional_transcripts enable row level security;
alter table public.intentional_cards enable row level security;
alter table public.intentional_time_logs enable row level security;

create policy "own transcripts" on public.intentional_transcripts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cards" on public.intentional_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own time logs" on public.intentional_time_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
