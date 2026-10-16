-- AC-0144 timing: one warm-up watch and five timed watches, as the operator, from psql.
-- The median of the five "Time:" lines is the result. Run after ac0144-fixture.sql:
--   docker exec -i supabase_db_meat-ops-b psql -U postgres -v ON_ERROR_STOP=1 < ac0144-time.sql
select user_id::text as op_sub from private.operators order by user_id limit 1 \gset
set role authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', :'op_sub')::text, false);
\timing on
\echo warm-up
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
\echo run 1
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
\echo run 2
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
\echo run 3
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
\echo run 4
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
\echo run 5
select open_count, urgent_count from public.refresh_alerts('2026-10-13');
