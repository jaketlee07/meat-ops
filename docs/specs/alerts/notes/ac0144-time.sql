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
\timing off
-- Proof the timed watch ran the yield rule: batches the rule takes as candidates
-- for the watch's 14 days (measured, produced 2026-09-30 to 2026-10-13), and the
-- yield alerts the watch left open.
reset role;
select (select count(*) from production_batches b
        where b.production_date between date '2026-10-13' - 13 and date '2026-10-13'
          and b.finished_lbs_out <> round(b.raw_lbs_in * (1 - b.shrink_pct_used), 3)) as yield_candidates,
       (select count(*) from alerts where type = 'yield_anomaly' and status = 'open') as open_yield_alerts;
