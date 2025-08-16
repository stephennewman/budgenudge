-- Create deals ingestion tables
create table if not exists public.deal_posts (
  id bigserial primary key,
  url text not null unique,
  title text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.deals (
  id bigserial primary key,
  post_id bigint not null references public.deal_posts(id) on delete cascade,
  store text not null default Publix,
  title text not null,
  brand text,
  size text,
  promo_type text,
  price_text text,
  unit_price_cents integer,
  starts_at date,
  ends_at date,
  created_at timestamptz default now(),
  unique (post_id, title, price_text)
);

create index if not exists deals_post_id_idx on public.deals(post_id);
