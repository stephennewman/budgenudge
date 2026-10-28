-- Reflect: retrospective capture. Adds a "lesson" card kind and a transcript mode.
alter table public.intentional_cards drop constraint if exists intentional_cards_kind_check;
alter table public.intentional_cards add constraint intentional_cards_kind_check
  check (kind in ('action', 'thought', 'idea', 'reminder', 'note', 'habit', 'principle', 'lesson'));

alter table public.intentional_transcripts
  add column if not exists mode text not null default 'dump' check (mode in ('dump', 'reflect'));

create index if not exists intentional_cards_user_completed_idx
  on public.intentional_cards (user_id, completed_at) where status = 'done';
