# Local stack reachable from web pages through loopback

- **Status:** Draft


## Outcome

A web page open in the owner's browser cannot read or change the local Supabase stack through `127.0.0.1`, or the owner has accepted that exposure on record.

## Boundary

- The firewall block from the local-ports spec leaves loopback open on purpose, so the app, the tests, and Studio keep working on this Mac.
- On 2026-10-09, requests over loopback that named a foreign `Host` got a 200 from Studio (54323), the API gateway (54321), and the mail API (54324). A page that points its own name at `127.0.0.1` after loading (DNS rebinding) could send such requests from the browser.
- Studio runs SQL as `postgres`, which bypasses row-level security, so such a page could read or change any table, `private.operators` included.
- The app's own Host check in `src/proxy.ts` covers the app only, not the stack's containers.

## Owner

- jaketlee07

## Unresolved questions

- Does the owner's browser stop a public page from reaching loopback?
- Can Studio, mail, and analytics stay off until needed, and can the API gateway refuse a foreign `Host`?

## Projection

- A small change through work-loop, or a recorded risk acceptance, once scheduled.


## Source

- Mode: repo-origin
- Locator: docs/specs/local-ports/spec.md
- Revision: e7c181d
- Authority: repo-origin
