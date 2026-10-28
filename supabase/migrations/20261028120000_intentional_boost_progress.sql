-- Manual drag nudges on top of the auto intention score, and live transcript processing progress.
alter table public.intentional_cards
  add column if not exists boost double precision not null default 0;

alter table public.intentional_transcripts
  add column if not exists status text not null default 'processing'
    check (status in ('processing', 'done', 'failed')),
  add column if not exists progress int not null default 0,
  add column if not exists log jsonb not null default '[]'::jsonb;
