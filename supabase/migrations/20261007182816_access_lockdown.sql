-- Access lockdown (foundation-hardening T3).
--
-- Only a signed-in operator reaches data and operations. Three layers:
--   1. Grants: every privilege on every public table and view is revoked first,
--      then granted back per role, so a default privilege cannot leave a hole.
--   2. RLS: every public table has a SELECT policy for authenticated operators;
--      master-data tables add INSERT and UPDATE policies. No DELETE policies.
--   3. Views run as the caller (security_invoker), so they obey the same RLS.
-- Sign-up and the 12-character password floor live in supabase/config.toml.
-- Ledger tables are written only by the SECURITY DEFINER operations.

-- ---- Grants ----------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated, service_role;

-- anon: nothing on any table or view.

-- authenticated and service_role: read everything, write master data only.
-- service_role has no DELETE anywhere and no ledger write.
grant select on all tables in schema public to authenticated, service_role;
grant insert, update on table
    public.vendors, public.customers, public.products,
    public.fee_types, public.product_fees
    to authenticated, service_role;

-- ---- Row level security ----------------------------------------------------

alter table public.vendors               enable row level security;
alter table public.customers             enable row level security;
alter table public.products              enable row level security;
alter table public.fee_types             enable row level security;
alter table public.product_fees          enable row level security;
alter table public.inventory_balances    enable row level security;
alter table public.lots                  enable row level security;
alter table public.production_batches    enable row level security;
alter table public.production_batch_lots enable row level security;
alter table public.finished_goods        enable row level security;
alter table public.sales                 enable row level security;
alter table public.sale_items            enable row level security;

create policy operators_select on public.vendors
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.customers
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.products
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.fee_types
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.product_fees
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.inventory_balances
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.lots
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.production_batches
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.production_batch_lots
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.finished_goods
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.sales
    for select to authenticated using ((select private.is_operator()));
create policy operators_select on public.sale_items
    for select to authenticated using ((select private.is_operator()));

-- Master data: operators may insert and update. An INSERT policy has only a
-- WITH CHECK clause; an UPDATE policy carries the same predicate in both.
create policy operators_insert on public.vendors
    for insert to authenticated with check ((select private.is_operator()));
create policy operators_update on public.vendors
    for update to authenticated
    using ((select private.is_operator())) with check ((select private.is_operator()));

create policy operators_insert on public.customers
    for insert to authenticated with check ((select private.is_operator()));
create policy operators_update on public.customers
    for update to authenticated
    using ((select private.is_operator())) with check ((select private.is_operator()));

create policy operators_insert on public.products
    for insert to authenticated with check ((select private.is_operator()));
create policy operators_update on public.products
    for update to authenticated
    using ((select private.is_operator())) with check ((select private.is_operator()));

create policy operators_insert on public.fee_types
    for insert to authenticated with check ((select private.is_operator()));
create policy operators_update on public.fee_types
    for update to authenticated
    using ((select private.is_operator())) with check ((select private.is_operator()));

create policy operators_insert on public.product_fees
    for insert to authenticated with check ((select private.is_operator()));
create policy operators_update on public.product_fees
    for update to authenticated
    using ((select private.is_operator())) with check ((select private.is_operator()));

-- ---- Views run as the caller ----------------------------------------------

alter view public.v_product_pricing   set (security_invoker = true);
alter view public.v_current_menu      set (security_invoker = true);
alter view public.v_sale_traceability set (security_invoker = true);

-- ---- Test-only helper removed ----------------------------------------------

drop function if exists public.reset_test_data();
