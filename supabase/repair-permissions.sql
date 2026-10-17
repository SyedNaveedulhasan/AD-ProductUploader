-- Run in the Supabase SQL Editor for an existing installation.
-- Does not change or delete any saved products or stores.
begin;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.stores, public.products to service_role;
revoke all on public.stores, public.products from anon, authenticated;
alter table public.stores enable row level security;
alter table public.products enable row level security;
commit;
