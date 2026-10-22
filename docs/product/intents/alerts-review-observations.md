# Alerts: observations the review set aside

- **Status:** Draft


## Outcome

The owner has decided, for each of six observations from the alerts build, whether it needs a change, and any change ships with a check that fails without it.

## Boundary

- The rendered-page inspection on 2026-10-16 (T7 in the alerts verification ledger) found the "Go to Receiving" and "Go to Production" links on `/alerts` cards about 12 px right of the card's text edge (`px-3` in `src/app/alerts/alert-card.tsx`), while the matching pricing link has none. Frontend review round 1 refuted it because no rule fixes link alignment.
- The same inspection found the Primary navigation wrapping to two rows with a gap, and wide side margins around the 36 rem column at 1024 px. No reviewer took these up.
- No test checks that a card's two buttons lose `aria-disabled` after a refused write leaves the card on the page: deleting `setPending(null)` in `src/app/alerts/alert-card.tsx` keeps every test green. Review round 3 narrowed the two busy-button test titles instead of adding that check.
- `raceCallsBehindLock` in `test/db.ts` ignores whether its lock statement locked a row and whether each call waited, so a future caller whose lock matches no row would run with no barrier and still pass. Review round 2 refuted it because today's only caller always locks the day's row.
- No test proves that the migration's own `private.baseline_list_prices()` call gives existing list prices their baseline rows: every test database starts empty, so deleting the call keeps every gate green. Review round 1 refuted it because the plan pinned a direct call of the function; it mattered only for the hosted rollout, and the hosted project held no products when the migration ran there.
- Security review round 1 did not check whether PostgREST cancels a watch statement when the app's 10-second limit aborts the request, so watches queued on the `refresh_alerts` advisory lock may be bounded only by the role's statement timeout.

## Owner

- jaketlee07

## Unresolved questions

- Which of the two layout observations read as problems on the owner's phone and laptop?
- Should the hosted rollout's own checks confirm one baseline row per priced product after the migration runs? No rows were due: the hosted project's `public.products` held 0 rows when the alerts migration ran there on 2026-10-21, so it had no list price to record (hosted-rollout verification ledger, T3).

## Projection

- A direct-light change for any layout or test item the owner picks, checked by the browser suite; the PostgREST question is a probe on the local stack first.


## Source

- Mode: repo-origin
- Locator: docs/specs/alerts/notes/verification-ledger.md
- Revision: 7e3b46e
- Authority: repo-origin
