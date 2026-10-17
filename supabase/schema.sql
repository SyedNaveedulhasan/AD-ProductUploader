-- Run once in the Supabase SQL editor. All data operations use authenticated server routes.
create table public.stores (
 id uuid primary key default gen_random_uuid(), owner_id text not null,
 name text not null, url text not null, credentials text not null, currency text not null default 'USD',
 created_at timestamptz not null default now(), unique(owner_id,url)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), owner_id text not null,
 store_id uuid not null references public.stores(id) on delete cascade,
 name text not null, sku text not null default '', type text not null default 'simple',
 price numeric not null default 0 check(price>=0), sale_price jsonb not null default '""',
 stock integer not null default 0 check(stock>=0), category text not null default '', description text not null default '',
 status text not null default 'draft' check(status in ('draft','publish')), image text not null default '',
 virtual boolean not null default false, downloadable boolean not null default false, download_url text not null default '',
 weight text not null default '', length text not null default '', width text not null default '', height text not null default '',
 external_url text not null default '', grouped_ids jsonb not null default '[]', variations jsonb not null default '[]',
 woo_id bigint, error text, publishing_until timestamptz, updated_at timestamptz not null default now()
);
create index products_owner_store on public.products(owner_id,store_id);
create unique index products_store_sku on public.products(store_id,sku) where sku<>'';
alter table public.stores enable row level security;
alter table public.products enable row level security;
-- No public/client policies: only service role may access. Routes enforce owner_id.
revoke all on public.stores from anon, authenticated;
revoke all on public.products from anon, authenticated;
-- New Supabase projects may not grant Data API access automatically.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.stores, public.products to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Images are public so WooCommerce can fetch them. Uploads require the server.
