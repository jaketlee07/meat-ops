-- ============================================================
-- Operator check (receiving T2).
--
-- The app needs to tell a signed-in user who is not on the allowlist apart
-- from an operator whose catalog is empty. A read of the catalog cannot: both
-- return no rows. This function answers with no side effect. It returns
-- nothing for an operator and raises SQLSTATE 42501 for anyone else.
--
-- SECURITY INVOKER is enough: authenticated already executes
-- private.is_operator(), which is itself SECURITY DEFINER.
--
-- The new function revokes the local default privileges before it grants.
-- ============================================================

create function public.check_operator() returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
    if private.is_operator() is not true then
        raise exception 'check_operator: not allowed (caller is not an operator)'
            using errcode = '42501';
    end if;
end $$;

revoke all on function public.check_operator() from public, anon, authenticated, service_role;
grant execute on function public.check_operator() to authenticated;
