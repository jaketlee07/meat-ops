-- ============================================================
-- Alerts, part 1: the private list-price history.
--
-- private.list_price_changes holds one row for each change of a product's
-- list price, with the product's cost per lb at that moment. A trigger on
-- products sees every writer, so set_list_price stays unchanged. The table
-- sits beside private.operators, out of the Data API, with no grant to any
-- API role. Every new object revokes the local default privileges before
-- anything is granted; nothing is granted back here.
-- ============================================================

create table private.list_price_changes (
    seq         bigint generated always as identity primary key,
    product_id  uuid not null references public.products(id),
    old_price   numeric(10,2),
    new_price   numeric(10,2),
    cost_per_lb numeric(12,4),
    changed_at  timestamptz not null default now(),
    baseline    boolean not null default false
);
revoke all on table private.list_price_changes from public, anon, authenticated, service_role;
-- Identity sequences keep the default privileges unless revoked here.
revoke all on sequence private.list_price_changes_seq_seq
    from public, anon, authenticated, service_role;

-- The cost comes from v_product_pricing so the price rule is not written a
-- third time; it is null while the product has no cost.
create function private.record_list_price_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
    v_cost numeric(12,4);
begin
    select vp.cost_per_lb into v_cost
    from public.v_product_pricing vp
    where vp.product_id = new.id and vp.has_cost;

    insert into private.list_price_changes(product_id, old_price, new_price, cost_per_lb)
    values (new.id, case when tg_op = 'UPDATE' then old.list_price_per_lb end,
            new.list_price_per_lb, v_cost);
    return null;
end;
$$;
revoke all on function private.record_list_price_change()
    from public, anon, authenticated, service_role;

create trigger products_record_list_price_insert
    after insert on public.products
    for each row
    when (new.list_price_per_lb is not null)
    execute function private.record_list_price_change();

create trigger products_record_list_price_update
    after update of list_price_per_lb on public.products
    for each row
    when (new.list_price_per_lb is distinct from old.list_price_per_lb)
    execute function private.record_list_price_change();

-- One baseline row for each product with a list price and no history row.
-- Safe to rerun.
create function private.baseline_list_prices() returns void
language sql security definer
set search_path = ''
as $$
    insert into private.list_price_changes(product_id, old_price, new_price, cost_per_lb, baseline)
    select p.id, null, p.list_price_per_lb,
           (select vp.cost_per_lb from public.v_product_pricing vp
            where vp.product_id = p.id and vp.has_cost),
           true
    from public.products p
    where p.list_price_per_lb is not null
      and not exists (select 1 from private.list_price_changes h where h.product_id = p.id);
$$;
revoke all on function private.baseline_list_prices()
    from public, anon, authenticated, service_role;

select private.baseline_list_prices();
