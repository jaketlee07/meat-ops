# Hosted rollout: two browser-suite failures under load

- **Status:** Draft


## Outcome

A browser-suite run leaves no spare app server running, even when it fails or times out, and the AC-0090 "no answer within 60 seconds" test reads the stored digest row only once its write is done.

## Boundary

- Spare app: after a 5,883-second `npm test` run on 2026-10-21 in which 16 browser tests failed, a `next-server` started by that run was still listening on 127.0.0.1:3102, the spare-app port (the app port plus 2), at about 97% CPU. It did not exit on SIGTERM and was stopped with SIGKILL. `startSpare` in `test/e2e/invoices-page.ts:732` starts it, and its `stop` sends one SIGTERM and waits for the process to close. Why it outlived the run was not probed.
- Digest row: in a `--last-failed` rerun on 2026-10-21, `test/e2e/alerts.spec.ts:1173` (AC-0090) saw the page show the try-again message while the stored digest row still read `status` `writing` with no `failure_kind`, where line 1182 expects `failed` and `no-answer`. The cause was not probed.
- Both came from runs the ledger records while the Mac was overloaded, and each full rerun after them passed all 667 browser tests.

## Owner

- jaketlee07

## Unresolved questions

- What leaves the AC-0090 row at `writing` after the page shows the try-again message?

## Projection

- A direct-light change to the browser-suite helpers, proved by a check that fails without it.


## Source

- Mode: repo-origin
- Locator: docs/specs/hosted-rollout/notes/verification-ledger.md
- Revision: 027d4a3
- Authority: repo-origin
