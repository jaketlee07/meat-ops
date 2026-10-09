# Spec: local-ports

- **Status:** Draft <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`docs/product/intents/local-stack-network-exposure.md`](../../product/intents/local-stack-network-exposure.md) (the outcome, and the overview sentences that must match it); the access model and the app trust boundary in [`docs/architecture/overview.md`](../../architecture/overview.md); the test harness's localhost guard (`resolveStackEnv` in `test/env.ts`, from [foundation-hardening](../foundation-hardening/spec.md)), which this check sits beside and does not weaken
- **Brief:** none
- **Discovery:** none
- **Contract:** none (a test-harness check and a machine setting; no published interface)
- **Shape:** integration

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory — it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

The local Supabase stack on the developer's Mac answers only that Mac, over
both IPv4 and IPv6, from the home Wi-Fi and from the internet. Docker Desktop
publishes the stack's ports on every network interface: 54321 (API and auth),
54322 (Postgres), 54323 (Studio), 54324 (mail), and 54327 (analytics). The
Supabase CLI has no setting that limits them. So the macOS application firewall
blocks incoming connections to the program that serves those ports, Docker's
port forwarder `com.docker.backend`. The firewall also asks before letting in
any downloaded app it has no rule for, so a Docker update that drops the block
ends in a question, not a silent opening. Loopback connections (to `127.0.0.1`
and `localhost`) are not filtered, so the app, the tests, and Studio in the
Mac's own browser keep working.

`npm test` and `npm run test:e2e` are development tools that run only against
the local stack. Before any test runs, they confirm the block. When it is not
in place, or the computer is not a Mac, the run stops and says what is wrong
and where the fix is. The owner runs every firewall command in their own
Terminal, outside the agent session. Because the ports were open for an
unknown time before this change, the local stack is then rebuilt from its
migrations and seed with no data kept, and Studio's snippets folder on this Mac
is confirmed empty.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Maintainer procedure | The block is a one-time setup on the developer's Mac, and the refusal messages point to it | `docs/architecture/overview.md`, a new section `Keep the local stack on this Mac`, the one home for the posture | jaketlee07 | The commands as the owner ran them, in the verification ledger | The section gives the why, the four setup commands, what they cover, the undo commands, the answer to give (Deny) when the Mac asks whether Docker may accept incoming connections and that loopback keeps working after it, and the accepted residual: the check runs only when tests run |
| Current architecture | The overview says only this machine reaches sign-in and that no client can change the operator list (the intent's Boundary), and its `test/` row lists every suite and harness file | `docs/architecture/overview.md`: the `private.operators` paragraph, the App trust boundary's Network bullet, and the Areas table's `test/` row | jaketlee07 | Diff of the three passages, reviewed | Each passage is accurate under the block and links to `Keep the local stack on this Mac`; the `test/` row names every harness and suite file this change adds |
| Agent guidance and commands | `AGENTS.md` "Build and test commands" lists one-time setup and when the tests refuse; both change | `AGENTS.md`, "Build and test commands" | jaketlee07 | Diff of one line | One line says the tests also refuse without the block and links to the overview section |
| Execution record | Refusal runs, the phone checks (the cellular attempt included), the loopback checks, and the rebuild need a home outside the contract | `docs/specs/local-ports/notes/verification-ledger.md` | work-loop | Ledger entries | Ledger holds every AC observation, and no global IPv6 address or prefix |
| Intent closeout | The intent and its backlog entry close when this ships | `docs/product/intents/local-stack-network-exposure.md`, `workspace.toml` `[backlog]` | close-work | none | close-work records the intent as delivered by this spec |
| Reusable learning | Docker Desktop ignores the network bind option; the Supabase CLI has no bind setting | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Run the check right after the localhost guard: at Playwright config load, before the web server builds, and in the shared test global setup, before its first write.
- Run each command the check uses with no shell, passing every value as its own argument.
- End every state in which Docker is unblocked or the firewall is off, including a stop or an unexpected result, by putting the block back and reading it back; when the block itself failed, stop the stack with `supabase stop` instead. Do no other work while such a state is open.
- Before any test run or the rebuild, confirm no test process from another worktree is running, because `meat-ops-sales` and `meat-ops-invoice` share this stack.
- Keep every refusal message free of keys, passwords, connection strings, and IP addresses; name only the condition, the program path, the port, and the overview section.

### Ask first

- Recommending or documenting any firewall setting beyond the block (for example "Block all incoming connections" or stealth mode).
- Any change to Docker Desktop settings, the Docker daemon config, or `supabase/config.toml`.
- Any way to skip or bypass the check, such as an environment variable.
- The rebuild's start time, because other worktrees share the stack.
- Deleting or changing any file found in `supabase/snippets/`.

### Never do

- Run `sudo`, or any command that changes a macOS setting, the application firewall included; the owner runs those in their own Terminal, outside the agent session.
- Add a dependency, a new top-level directory, or app code under `src/`; the check lives in the existing test harness under `test/`.
- Weaken or reorder the localhost guard in `test/env.ts`.
- Write the Mac's global IPv6 address or prefix into the repository.

## Testing Strategy

- **TDD, unit tests over recorded outputs (AC-0003, AC-0004, AC-0005, AC-0008, AC-0013)**: the check's decision, from the platform and each command's output to a pass or one named refusal, is a pure function with a compressible invariant. Recorded outputs of each command the check runs drive it, and only a unit test reaches the non-macOS branch on this Mac. The same tests cover the AC-0001 and AC-0002 messages as construction for the recorded runs below.
- **Manual QA against the real firewall, recorded in the verification ledger (AC-0001, AC-0002)**: the real `npm test` and `npm run test:e2e`, run in each firewall state the owner sets. Only the real run proves the check fires before any test in both Vitest and Playwright.
- **Goal-based: the full suite with the block on (AC-0006)**: `npm test` passing shows the suites still reach the API (54321) and Postgres (54322) over loopback.
- **Manual QA from this Mac, recorded in the ledger (AC-0009)**: a TCP connect to `127.0.0.1` on each published stack port, because no suite uses Studio, mail, or analytics.
- **Manual QA by the owner from another device, recorded in the ledger (AC-0007, AC-0010, AC-0011)**: a phone on the same Wi-Fi loads Studio with Docker not blocked, then fails to load it with the block on, at the same addresses in the same session. The earlier successful load is what makes the later failure count. Whether the firewall filters this Mac's own network addresses is unknown (see Assumptions), so no probe from this Mac counts for these criteria.
- **Manual QA recorded in the ledger (AC-0012, AC-0014)**: the rebuild's volume creation times and applied migrations, read after `supabase start`, and a listing of `supabase/snippets/`.

Stub tally: T1 is covered by a validated stub; T2, T3, and T4 record `no stub (mode)`; none is uncovered.

## Acceptance Criteria

Definitions used by these criteria:

- **The check**: the network check `npm test` and `npm run test:e2e` run before any test, at the points named in Boundaries.
- **Refuses**: `npm test` or `npm run test:e2e` exits non-zero before any test runs (and, for `npm run test:e2e`, before the app is built), printing one message whose last sentence is `See "Keep the local stack on this Mac" in docs/architecture/overview.md.`
- **Published stack port**: a host port that Docker publishes for a running container of the local Supabase stack whose database the tests use.
- **The block**: the macOS application firewall on, the program serving every published stack port blocked, and automatic allow of downloaded signed software off.

- [ ] **AC-0001.** With the macOS firewall off, both commands refuse, and the message says the firewall is off.
- [ ] **AC-0002.** With the firewall on and a program that serves a published stack port not blocked, both commands refuse, and the message names that program's path and the port.
- [ ] **AC-0003.** The check refuses when any published stack port, not only the API port, is served by a program the firewall does not block.
- [ ] **AC-0004.** The check refuses on any platform other than macOS, saying the network check supports only macOS.
- [ ] **AC-0005.** The check refuses, rather than passing, when any command it runs is missing, exits non-zero, or prints output it cannot parse exactly, including a port entry or a firewall line it does not recognize.
- [ ] **AC-0006.** With the block on, `npm test` passes.
- [ ] **AC-0007.** With the block on, a browser on another device on the same Wi-Fi cannot load `http://<the Mac's IPv4 network address>:54323`.
- [ ] **AC-0008.** The check refuses when it finds no published stack port, or a published stack port with no program it can name serving it.
- [ ] **AC-0009.** With the block on, a TCP connection from this Mac to `127.0.0.1` succeeds on every published stack port.
- [ ] **AC-0010.** In the same session as AC-0007 and AC-0011, with Docker not blocked, the same browser on the same device and Wi-Fi loads Studio at the Mac's IPv4 network address and at a global IPv6 address of the Mac.
- [ ] **AC-0011.** With the block on, a browser on another device on the same Wi-Fi cannot load Studio at a global IPv6 address of the Mac.
- [ ] **AC-0012.** With the block on and after every AC-0010 load, the local stack is rebuilt with no data kept: every Docker volume of the stack was created after the rebuild started, and `supabase_migrations.schema_migrations` lists exactly the migration files in `supabase/migrations/`.
- [ ] **AC-0013.** The check refuses when the firewall automatically allows downloaded signed software.
- [ ] **AC-0014.** After the rebuild, `supabase/snippets/` holds no file.

## Follow-ons

- jaketlee07: [`docs/product/intents/local-stack-loopback-web-pages.md`](../../product/intents/local-stack-loopback-web-pages.md): a web page in the owner's browser could reach Studio and the API through `127.0.0.1`, which the block leaves open by design.

## Assumptions

- Technical: the Supabase CLI publishes each port with a host port and no host address, and has no setting to change it, in both 2.95.4 (installed) and 2.120.0 (newest, 2026-10-06); its start notice says "All services bind to 0.0.0.0" (source: `supabase/cli` start code at tags v2.95.4 and v2.120.0)
- Technical: Docker Desktop 4.68.0 (engine 29.3.1) keeps a published port on `127.0.0.1` only when the publish names that address; it ignores the network option `com.docker.network.bridge.host_binding_ipv4`, and the daemon `"ip"` key covers only Docker's default bridge network (source: throwaway-container probe 2026-10-09; https://docs.docker.com/engine/network/port-publishing/)
- Technical: every published stack port is one wildcard socket, IPv4 and IPv6, served by `/Applications/Docker.app/Contents/MacOS/com.docker.backend`; `lsof -a -p <pid> -d txt -Fn` names that executable as the kernel records it (source: `lsof`, 2026-10-09)
- Technical: the Mac has global IPv6 addresses, and ports 54321 to 54323 answered on one of them with the firewall off; whether the home gateway passes unsolicited inbound IPv6 is unknown until the owner's cellular test (source: `ifconfig` and `nc -6` probe 2026-10-09)
- Technical: `socketfilterfw --getglobalstate`, `--getappblocked <path>`, and `--getallowsigned` read the firewall state without a password (source: probe 2026-10-09)
- Technical: Playwright 1.64 starts its web server (a plugin setup task) before global setup, so a refusal in global setup alone would come after the app build (source: `createGlobalSetupTasks` in `node_modules/playwright/lib/runner/index.js`)
- Technical: no test or app file uses ports 54323, 54324, or 54327 (source: `grep` over `test/`, `src/`, and both runner configs, 2026-10-09)
- Technical: whether the firewall filters this Mac's connections to its own network addresses is unknown, so the phone checks are the proof for other devices (source: user confirmation 2026-10-09)
- Product: the owner chose the firewall block over a Docker setting, which cannot work here, and over accepting the risk (source: user confirmation 2026-10-09)
- Product: the owner turned the block on in their own Terminal on 2026-10-09, before this spec's approval, to close the possible internet exposure at once (source: user confirmation 2026-10-09)
- Product: when a Docker update drops the block, the Mac asks before letting Docker in; the owner turns off automatic allow for downloaded signed software for this (source: user confirmation 2026-10-09)
- Product: the check runs only when tests run, so a firewall turned off between test runs is caught at the next run; the owner accepts that residual (source: user confirmation 2026-10-09)
- Product: `npm test` is a development tool that never runs against the deployed app, and the owner develops on a Mac, so the check refuses on any other platform; no CI workflow or git hook runs the tests (source: user confirmation 2026-10-09; no `.github`, `.husky`, or active `.git/hooks` entry)
- Product: the block covers every Docker-published port on this Mac, including other projects' containers (source: user confirmation 2026-10-09)
- Product: the owner chose a rebuild over a read-only leftovers check, on the stated condition that the local database holds nothing they need; this answers the intent's real-data question (source: user confirmation 2026-10-09)
- Product: the owner tries Studio from the phone on cellular data while Docker is unblocked; the ledger records the result, and a successful load is reported to the owner, but it is not part of the AC-0010 control (source: user confirmation 2026-10-09)
- Product: a web page reaching the stack through loopback is a separate follow-on, not this spec's scope (source: user confirmation 2026-10-09)
- Technical: three worktrees (`meat-ops`, `meat-ops-sales`, `meat-ops-invoice`) share one local stack; on 2026-10-09 it held only `main`'s migrations, and neither other worktree had added a migration file (source: `git worktree list`, `supabase_migrations.schema_migrations`, `git ls-files` in each worktree)
- Technical: Playwright loads its config again in every worker process and sets `TEST_WORKER_INDEX` there (source: `node_modules/playwright/lib/common/index.js` `deserializeConfig`, `node_modules/playwright/lib/worker/workerProcessEntry.js`)
- Process: the owner runs every firewall command in their own Terminal and does the phone checks (source: user confirmation 2026-10-09)
- Process: full mode, because the change alters a network trust boundary; spec and plan are approved by the owner in chat after adversarial, security, and shaping review, and ACs number from AC-0001 per spec (source: `docs/specs/receiving/spec.md`, `docs/specs/production/spec.md`)
