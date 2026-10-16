-- ============================================================
-- Invoice entry (invoice-entry T2).
--
-- A photo or typed text of a supplier invoice is read into a draft: one
-- import_drafts row and 1 to 30 import_draft_lines rows. A draft holds only
-- what the reading proposed; no lot exists until the owner confirms. Three
-- functions are added:
--   create_import_draft   stores a waiting draft and its lines.
--   confirm_import_draft  saves the given lines as lots through receive_lot,
--                         all or nothing, and settles the draft.
--   discard_import_draft  settles the draft and clears its photo, its typed
--                         text, and every line's words.
--
-- Weights and costs arrive as JSON text and are cast to numeric here, so no
-- JavaScript number carries one. A numeric(14,3) column would round a longer
-- weight without a word, so the decimal places are counted on the uncast
-- value and a longer one is refused.
-- Every function sets search_path = '' and schema-qualifies every name, and
-- revokes the local default privileges before it grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables and checks
-- ------------------------------------------------------------

create table public.import_drafts (
    id                 uuid primary key default gen_random_uuid(),
    source             text not null check (source in ('photo', 'text')),
    capture_text       text check (char_length(capture_text) between 1 and 2000),
    capture_image      bytea check (octet_length(capture_image) <= 4194304),
    capture_image_type text check (capture_image_type in ('image/jpeg', 'image/png', 'image/webp')),
    captured_on        date not null,
    captured_at        timestamptz not null default now(),
    model              text not null check (btrim(model) <> ''),
    status             text not null default 'pending'
                       check (status in ('pending', 'confirmed', 'discarded')),
    settled_at         timestamptz,
    -- A discarded draft holds no capture; any other holds exactly its source's.
    constraint import_drafts_capture_matches_source check (
        case
            when status = 'discarded' then
                capture_text is null and capture_image is null and capture_image_type is null
            when source = 'text' then
                capture_text is not null and capture_image is null and capture_image_type is null
            else
                capture_image is not null and capture_image_type is not null and capture_text is null
        end),
    -- Waiting means unsettled, and only waiting drafts are unsettled.
    constraint import_drafts_settled_matches_status check ((status = 'pending') = (settled_at is null))
);

create table public.import_draft_lines (
    id              uuid primary key default gen_random_uuid(),
    import_draft_id uuid not null references public.import_drafts (id),
    line_no         int not null check (line_no between 1 and 30),
    words           text check (words is null or (btrim(words) <> '' and char_length(words) <= 200)),
    product_id      uuid references public.products (id),
    vendor_id       uuid references public.vendors (id),
    weight_lbs      numeric(14,3) check (weight_lbs > 0),
    unit_cost       numeric(12,4) check (unit_cost >= 0),
    received_date   date,
    unsure_fields   text[] not null default '{}'
                    check (unsure_fields <@ array['product', 'vendor', 'weight', 'cost', 'date']),
    status          text not null default 'pending' check (status in ('pending', 'saved', 'skipped')),
    lot_id          uuid unique references public.lots (id),
    unique (import_draft_id, line_no),
    constraint import_draft_lines_saved_has_lot check ((status = 'saved') = (lot_id is not null))
);

-- ------------------------------------------------------------
-- 2. RLS, grants, policies
-- ------------------------------------------------------------

alter table public.import_drafts      enable row level security;
alter table public.import_draft_lines enable row level security;

revoke all on table public.import_drafts, public.import_draft_lines
    from public, anon, authenticated, service_role;
grant select on table public.import_drafts, public.import_draft_lines
    to authenticated, service_role;

create policy operators_select on public.import_drafts
    for select to authenticated using (private.is_operator());
create policy operators_select on public.import_draft_lines
    for select to authenticated using (private.is_operator());

-- ------------------------------------------------------------
-- 3. create_import_draft
-- ------------------------------------------------------------

create function public.create_import_draft(
    p_source             text,
    p_captured_on        date,
    p_model              text,
    p_lines              jsonb,
    p_capture_text       text default null,
    p_capture_image      bytea default null,
    p_capture_image_type text default null
) returns public.import_drafts
language plpgsql security definer
set search_path = ''
as $$
declare
    c_uuid   constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    c_number constant text := '^-?[0-9]+(\.[0-9]+)?$';
    v_draft   public.import_drafts;
    v_line    jsonb;
    v_no      int;
    v_text    text;
    v_words   text;
    v_product uuid;
    v_vendor  uuid;
    v_weight  numeric;
    v_cost    numeric;
    v_date    date;
    v_unsure  text[];
begin
    perform private.assert_caller('create_import_draft');

    if p_source is distinct from 'photo' and p_source is distinct from 'text' then
        raise exception 'create_import_draft: source must be photo or text';
    end if;
    if p_captured_on is null then
        raise exception 'create_import_draft: capture date is required';
    end if;
    if p_model is null or p_model ~ '^\s*$' then
        raise exception 'create_import_draft: model name is required';
    end if;

    if p_source = 'photo' then
        if p_capture_text is not null then
            raise exception 'create_import_draft: a photo draft holds no typed text';
        end if;
        if p_capture_image is null or octet_length(p_capture_image) = 0 then
            raise exception 'create_import_draft: a photo draft needs an image';
        end if;
        if octet_length(p_capture_image) > 4194304 then
            raise exception 'create_import_draft: image is over 4194304 bytes';
        end if;
        if p_capture_image_type is null
           or p_capture_image_type not in ('image/jpeg', 'image/png', 'image/webp') then
            raise exception 'create_import_draft: image type must be image/jpeg, image/png, or image/webp';
        end if;
    else
        if p_capture_image is not null or p_capture_image_type is not null then
            raise exception 'create_import_draft: a text draft holds no photo';
        end if;
        if p_capture_text is null or p_capture_text ~ '^\s*$' then
            raise exception 'create_import_draft: text is blank';
        end if;
        if char_length(p_capture_text) > 2000 then
            raise exception 'create_import_draft: text is over 2000 characters';
        end if;
    end if;

    if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
        raise exception 'create_import_draft: a draft needs at least 1 line';
    end if;
    if jsonb_array_length(p_lines) > 30 then
        raise exception 'create_import_draft: a draft holds at most 30 lines';
    end if;

    insert into public.import_drafts (source, capture_text, capture_image, capture_image_type, captured_on, model)
    values (p_source, p_capture_text, p_capture_image, p_capture_image_type, p_captured_on, p_model)
    returning * into v_draft;

    for v_line, v_no in
        select e.value, e.ordinality::int
        from jsonb_array_elements(p_lines) with ordinality as e(value, ordinality)
        order by e.ordinality
    loop
        if jsonb_typeof(v_line) <> 'object' then
            raise exception 'create_import_draft: line % is not an object', v_no;
        end if;

        if jsonb_typeof(v_line -> 'words') is distinct from 'string'
           or (v_line ->> 'words') ~ '^\s*$' then
            raise exception 'create_import_draft: line % has no words', v_no;
        end if;
        v_words := v_line ->> 'words';
        if char_length(v_words) > 200 then
            raise exception 'create_import_draft: line % words are over 200 characters', v_no;
        end if;

        v_product := null;
        v_text := v_line ->> 'product_id';
        if v_text is not null then
            if v_text !~* c_uuid then
                raise exception 'create_import_draft: line % product is not a valid id', v_no;
            end if;
            v_product := v_text::uuid;
            if not exists (
                select 1 from public.products p
                where p.id = v_product and p.kind = 'raw' and p.active
            ) then
                raise exception 'create_import_draft: line % product % is not an active raw product', v_no, v_product;
            end if;
        end if;

        v_vendor := null;
        v_text := v_line ->> 'vendor_id';
        if v_text is not null then
            if v_text !~* c_uuid then
                raise exception 'create_import_draft: line % vendor is not a valid id', v_no;
            end if;
            v_vendor := v_text::uuid;
            if not exists (select 1 from public.vendors v where v.id = v_vendor) then
                raise exception 'create_import_draft: line % vendor % not found', v_no, v_vendor;
            end if;
        end if;

        v_weight := null;
        v_text := v_line ->> 'weight_lbs';
        if v_text is not null then
            if v_text !~ c_number then
                raise exception 'create_import_draft: line % weight is not a number', v_no;
            end if;
            v_weight := v_text::numeric;
            if v_weight <= 0 then
                raise exception 'create_import_draft: line % weight must be above 0', v_no;
            end if;
            if scale(v_weight) > 3 then
                raise exception 'create_import_draft: line % weight has more than 3 decimal places', v_no;
            end if;
            if v_weight >= 100000000000 then
                raise exception 'create_import_draft: line % weight is too large', v_no;
            end if;
        end if;

        v_cost := null;
        v_text := v_line ->> 'unit_cost';
        if v_text is not null then
            if v_text !~ c_number then
                raise exception 'create_import_draft: line % cost is not a number', v_no;
            end if;
            v_cost := v_text::numeric;
            if v_cost < 0 then
                raise exception 'create_import_draft: line % cost must be 0 or more', v_no;
            end if;
            if scale(v_cost) > 4 then
                raise exception 'create_import_draft: line % cost has more than 4 decimal places', v_no;
            end if;
            if v_cost >= 100000000 then
                raise exception 'create_import_draft: line % cost is too large', v_no;
            end if;
        end if;

        v_date := null;
        v_text := v_line ->> 'received_date';
        if v_text is not null then
            begin
                if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
                    raise exception 'bad date format';
                end if;
                v_date := v_text::date;
            exception when others then
                raise exception 'create_import_draft: line % date is not a valid date', v_no;
            end;
        end if;

        v_unsure := '{}';
        if coalesce(jsonb_typeof(v_line -> 'unsure'), 'null') <> 'null' then
            if jsonb_typeof(v_line -> 'unsure') <> 'array' then
                raise exception 'create_import_draft: line % unsure must be a list', v_no;
            end if;
            if exists (
                select 1 from jsonb_array_elements(v_line -> 'unsure') u(x)
                where jsonb_typeof(u.x) <> 'string'
                   or (u.x #>> '{}') <> all (array['product', 'vendor', 'weight', 'cost', 'date'])
            ) then
                raise exception 'create_import_draft: line % unsure names a field other than product, vendor, weight, cost, or date', v_no;
            end if;
            select coalesce(array_agg(u.x #>> '{}'), '{}'::text[]) into v_unsure
            from jsonb_array_elements(v_line -> 'unsure') u(x);
        end if;

        insert into public.import_draft_lines
            (import_draft_id, line_no, words, product_id, vendor_id, weight_lbs, unit_cost, received_date, unsure_fields)
        values
            (v_draft.id, v_no, v_words, v_product, v_vendor, v_weight, v_cost, v_date, v_unsure);
    end loop;

    return v_draft;
end $$;
revoke all on function public.create_import_draft(text, date, text, jsonb, text, bytea, text)
    from public, anon, authenticated, service_role;
grant execute on function public.create_import_draft(text, date, text, jsonb, text, bytea, text)
    to authenticated;

-- ------------------------------------------------------------
-- 4. confirm_import_draft
-- ------------------------------------------------------------

-- Value checks first, then the draft row lock. A second concurrent call waits
-- on the lock, finds the draft confirmed, and is refused. Lines enter in
-- (product id, line number) order, so two saves never lock products in
-- opposite orders and one product's lines keep their line order. Each
-- receive_lot call re-raises its refusal with the line's number; the raise
-- rolls back every lot made so far.
create function public.confirm_import_draft(
    p_draft_id uuid,
    p_lines    jsonb
) returns setof public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    c_uuid   constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    c_number constant text := '^-?[0-9]+(\.[0-9]+)?$';
    v_draft public.import_drafts;
    v_line  jsonb;
    v_pos   int;
    v_no    int;
    v_id    uuid;
    v_seen  uuid[] := '{}';
    v_field text;
    v_text  text;
    v_lot   public.lots;
    r       record;
begin
    perform private.assert_caller('confirm_import_draft');

    if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
        raise exception 'confirm_import_draft: no line to save';
    end if;

    for v_line, v_pos in
        select e.value, e.ordinality::int
        from jsonb_array_elements(p_lines) with ordinality as e(value, ordinality)
        order by e.ordinality
    loop
        if jsonb_typeof(v_line) <> 'object' then
            raise exception 'confirm_import_draft: line % is not an object', v_pos;
        end if;

        v_text := v_line ->> 'line_id';
        if v_text is null then
            raise exception 'confirm_import_draft: line % is missing line_id', v_pos;
        end if;
        if v_text !~* c_uuid then
            raise exception 'confirm_import_draft: line % has a line_id that is not a valid id', v_pos;
        end if;
        v_id := v_text::uuid;
        if v_id = any (v_seen) then
            raise exception 'confirm_import_draft: line % is given twice', v_id;
        end if;
        v_seen := v_seen || v_id;

        -- Name the line by its number in the draft when it is one of its lines.
        select d.line_no into v_no
        from public.import_draft_lines d
        where d.id = v_id and d.import_draft_id = p_draft_id;
        v_no := coalesce(v_no, v_pos);

        foreach v_field in array array['product_id', 'vendor_id', 'weight_lbs', 'unit_cost', 'received_date'] loop
            v_text := v_line ->> v_field;
            if v_text is null then
                raise exception 'confirm_import_draft: line % is missing %', v_no, v_field;
            end if;
            if v_field in ('product_id', 'vendor_id') and v_text !~* c_uuid then
                raise exception 'confirm_import_draft: line % % is not a valid id', v_no, v_field;
            end if;
            if v_field in ('weight_lbs', 'unit_cost') and v_text !~ c_number then
                raise exception 'confirm_import_draft: line % % is not a number', v_no, v_field;
            end if;
            if v_field = 'received_date' then
                begin
                    if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
                        raise exception 'bad date format';
                    end if;
                    perform v_text::date;
                exception when others then
                    raise exception 'confirm_import_draft: line % received_date is not a valid date', v_no;
                end;
            end if;
        end loop;
    end loop;

    select * into v_draft from public.import_drafts where id = p_draft_id for update;
    if not found then
        raise exception 'confirm_import_draft: draft % not found', p_draft_id;
    end if;
    if v_draft.status <> 'pending' then
        raise exception 'confirm_import_draft: draft % is already saved or discarded', p_draft_id;
    end if;

    foreach v_id in array v_seen loop
        if not exists (
            select 1 from public.import_draft_lines d
            where d.id = v_id and d.import_draft_id = p_draft_id
        ) then
            raise exception 'confirm_import_draft: line % is not in this draft', v_id;
        end if;
    end loop;

    for r in
        select e.value as given, d.id as line_id, d.line_no
        from jsonb_array_elements(p_lines) e(value)
        join public.import_draft_lines d on d.id = (e.value ->> 'line_id')::uuid
        order by (e.value ->> 'product_id')::uuid, d.line_no
    loop
        begin
            v_lot := public.receive_lot(
                p_product_id => (r.given ->> 'product_id')::uuid,
                p_vendor_id  => (r.given ->> 'vendor_id')::uuid,
                p_weight_lbs => (r.given ->> 'weight_lbs')::numeric,
                p_unit_cost  => (r.given ->> 'unit_cost')::numeric,
                p_received   => (r.given ->> 'received_date')::date
            );
        exception when others then
            raise exception using
                message = format('line %s: %s', r.line_no, sqlerrm),
                errcode = sqlstate;
        end;
        update public.import_draft_lines
        set status = 'saved', lot_id = v_lot.id
        where id = r.line_id;
    end loop;

    update public.import_draft_lines
    set status = 'skipped'
    where import_draft_id = p_draft_id and status = 'pending';

    update public.import_drafts
    set status = 'confirmed', settled_at = now()
    where id = p_draft_id;

    return query
        select l.*
        from public.lots l
        join public.import_draft_lines d on d.lot_id = l.id
        where d.import_draft_id = p_draft_id
        order by d.line_no;
end $$;
revoke all on function public.confirm_import_draft(uuid, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.confirm_import_draft(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 5. discard_import_draft
-- ------------------------------------------------------------

-- Settles a waiting draft and drops what it held: the photo, its type, the
-- typed text, and every line's words. No ledger row is touched.
create function public.discard_import_draft(
    p_draft_id uuid
) returns public.import_drafts
language plpgsql security definer
set search_path = ''
as $$
declare
    v_draft public.import_drafts;
begin
    perform private.assert_caller('discard_import_draft');

    select * into v_draft from public.import_drafts where id = p_draft_id for update;
    if not found then
        raise exception 'discard_import_draft: draft % not found', p_draft_id;
    end if;
    if v_draft.status <> 'pending' then
        raise exception 'discard_import_draft: draft % is already saved or discarded', p_draft_id;
    end if;

    update public.import_draft_lines
    set status = 'skipped', words = null
    where import_draft_id = p_draft_id;

    update public.import_drafts
    set status = 'discarded', settled_at = now(),
        capture_text = null, capture_image = null, capture_image_type = null
    where id = p_draft_id
    returning * into v_draft;

    return v_draft;
end $$;
revoke all on function public.discard_import_draft(uuid)
    from public, anon, authenticated, service_role;
grant execute on function public.discard_import_draft(uuid) to authenticated;
