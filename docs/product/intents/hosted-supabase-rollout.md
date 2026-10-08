# Hosted Supabase rollout

- **Status:** Draft


## Outcome

The hosted Supabase project runs the hardened engine and is safe to hold real business data.

## Boundary

- Turn off public sign-up and set a 12-character minimum password in the hosted project.
- Apply every migration the hosted project lacks, in file order, after checking for lots with no vendor.
- Create the owner account with a 12-character password, confirm it is new with no earlier sessions, then add its id to private.operators.
- Run a read-only check that the anon key and a signed-in non-operator reach nothing and that reset_test_data is absent.
- Load no real business data before that check passes. Every write to the hosted project needs the owner's approval.

## Owner

- jaketlee07

## Unresolved questions

- Is MFA required for the owner login?
- Which migrations, if any, are already applied to the hosted project?

## Projection

- A spec through new-spec once the owner schedules the hosted rollout.


## Source

- Mode: repo-origin
- Locator: docs/specs/foundation-hardening/spec.md
- Revision: adcb0a0
- Authority: repo-origin
