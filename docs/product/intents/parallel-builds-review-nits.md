# Stack choice review gaps

- **Status:** Draft


## Outcome

A folder's stack choice, and the check before a test run, reset, or stop, hold for every input the Supabase CLI and other projects can present, not only for the files the `AGENTS.md` steps create.

## Boundary

- The own-stack check in test/env.ts misses three forms that the Supabase CLI 2.95.4 reads as setting the project (probed on 2026-10-13): a carriage return inside the setting name, a setting after a quoted value that closes on a line starting with `#`, and settings in `supabase/.env.local`. A folder written that way runs on its own stack without the `E2E_PORT` requirement or the wrong-stack refusal.
- The `AGENTS.md` check before a test run, reset, or stop treats a listed folder from another project as using neither stack. The `mobilize` worktrees' `supabase/config.toml` names stack A's ports, 54321 and 54322, so a run there could share stack A.
- No `AGENTS.md` step creates any of these, and on 2026-10-13 neither applied: no such file existed, and no other process held a connection to stack A's ports.

## Owner

- jaketlee07

## Unresolved questions

- Whether to close the env-form gap in code, by counting any mention of `SUPABASE_PROJECT_ID` and refusing stack settings in other env files, or to keep it as a written rule.

## Projection

- A direct-light change for the code route, or one `AGENTS.md` sentence for the written route. A second sentence would count a listed folder from another project as stack A when its Supabase config uses port 54321 or 54322.


## Source

- Mode: repo-origin
- Locator: docs/specs/parallel-builds/notes/verification-ledger.md
- Revision: 376db3a
- Authority: repo-origin
