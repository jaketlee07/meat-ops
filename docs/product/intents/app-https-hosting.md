# Host the app over HTTPS

- **Status:** Draft


## Outcome

The owner logs receipts and batches from a phone on the floor over an encrypted connection, and can install the app on that phone.

## Boundary

- Host the Next.js app so a phone reaches it over HTTPS, with every auth cookie marked Secure.
- Keep the app environment free of privileged variables, as the receiving spec's guard enforces.
- Revisit the shared sign-in rate limit, which the local-only scope accepted.
- Make the app installable on a phone (a web app manifest), as `SYSTEM-SPEC.md` §8 asks; installing needs HTTPS, and the offline queue stays roadmap (§9).
- Before the app is reachable from another machine, the hosted auth server ends a session after 12 hours without activity and 7 days after sign-in, the limits the receiving spec set locally.

## Owner

- jaketlee07

## Unresolved questions

- Where is the app hosted?
- Does app hosting ship with the hosted Supabase rollout or after it? After it: the hosted rollout shipped on 2026-10-21 in PR #37, and the app stays on the local stack.
- Does the hosted Supabase plan support the session time limits? Only the Pro plan sets them (https://supabase.com/docs/guides/auth/sessions), so the hosted project, on the free plan, needs Pro before the app is reachable from another machine.

## Projection

- The app side is built and tested on this Mac by `docs/specs/app-hosting/`: Secure auth cookies, the `APP_HOST` Host allowlist with look-alikes refused, the HTTPS header, and the install file with its icons. The owner accepted the shared sign-in limit on any host on 2026-10-27.
- The online step remains, as a spec through new-spec once the owner schedules it. It chooses the host and deploys with `APP_HOST` set. The host's front end passes the public name as `Host`, and redirects or refuses plain http before it reaches sign-in or a server action. The app listens where that front end reaches it: `npm run start` binds `127.0.0.1`, so either the front end runs on the same machine, or a reviewed change to the receiving loopback-only criterion comes first. The app runs with `TZ` set to the business's time zone. The session limits above hold before the app is reachable from another machine. Some front ends pass the name the browser asked for in a second header, `X-Forwarded-Host`, and Next.js checks a server action's origin against that header; the step decides whether that header must match `Host`. A page on a sibling name under the same domain, or a first visit over plain http, could plant its own sign-in cookie. Two settings stop that: the `__Host-` cookie name prefix, which locks a cookie to the exact name over HTTPS, and the HTTPS header's `includeSubDomains` and preload options, which make browsers use HTTPS for every name under the domain from the first visit. The step decides both once the domain is chosen. The app-hosting build checked neither. The step also decides the hosted model key and installs the app on the business owner's phone over HTTPS.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving/spec.md
- Revision: 683782e
- Authority: repo-origin
