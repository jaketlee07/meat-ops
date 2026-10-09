# Plan: local-ports

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the app trust boundary and access model in `docs/architecture/overview.md`; the localhost guard `assertLocalUrl`/`resolveStackEnv` in `test/env.ts` and its tests in `test/env.test.ts` (from foundation-hardening), the analogous harness refusal this check sits beside; its two call sites, `playwright.config.ts` at config load and `test/global-setup.ts` for both runners, the construction path. Deviation: none; the check runs at the same two points as the guard.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes — the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

One new harness module, `test/network.ts`, exports `localStackRefusal`. It
takes the platform, the database port the localhost guard resolved, and a
command runner, and returns a refusal message or `null`. Unit tests drive it
with a fake runner that replays recorded command outputs.
`playwright.config.ts` calls it right after `resolveStackEnv()` at config load,
so `npm run test:e2e` refuses before the web server builds the app.
`test/global-setup.ts` calls it right after `resolveStackEnv()`, so Vitest
refuses before any suite runs or setup writes. The overview gains the section
the messages point to, and its three affected passages and `AGENTS.md` are
brought in line.

The owner turned the block on before approval. The riskiest part is proof that
it holds for other devices, which needs the ports briefly open again. T3 opens
one short window, in a fixed order the owner runs from their own Terminal:
unblock Docker, turn the firewall off, then put the block back. Each state
gives one refusal run, and the phone loads in the first state are the control
that makes the failed loads after the block count. Every exit from the window,
a stop included, ends with the block back on or the stack stopped. If the block
held, T4 then rebuilds the local stack with no data kept, because anyone who
reached it before the block could have changed it.

## Constraints

- The foundation-hardening localhost guard in `test/env.ts` runs first and is unchanged.
- `AGENTS.md` hard rule 6 and the build commands: run `npm test` after the change, with `npm run dev`/`npm run start` stopped; there is no lint command.
- `AGENTS.md` hard rule 4: no em dashes in copy, comments, or commit messages. This plan's template quote blocks are not copy.
- The owner runs every `sudo` command in their own Terminal (spec Boundaries, Never do).
- No global IPv6 address or prefix is written into the repository, the ledger included (spec Boundaries, Never do).
- `psql` is not installed on the host; database queries go through `docker exec supabase_db_meat-ops psql -U postgres`.
- `meat-ops-sales` and `meat-ops-invoice` share this stack: no test run or rebuild starts while one of their test processes runs, and the rebuild waits for the owner's go-ahead.

## Construction tests

**Integration tests:** none beyond per-task tests.
**Manual verification:** the T3 window and the T4 rebuild, recorded in the ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Maintainer procedure, overview section `Keep the local stack on this Mac` | T2 | Section in the diff; the ledger shows the owner ran its commands | Refusal messages name the section, and its anchor resolves |
| Current architecture, the overview's `private.operators` paragraph, Network bullet, and `test/` row | T2 | Diff of the three passages | Each is accurate under the block and links to the section; the row names the new files |
| Agent guidance, `AGENTS.md` "Build and test commands" | T2 | One-line diff | The line links to the section |
| Execution record, `notes/verification-ledger.md` | T2, T3, T4 | Ledger entries, the cellular attempt included | Every AC observation is there; no global IPv6 address or prefix is |
| Intent closeout | close-work | none | Intent marked delivered by this spec |
| Reusable learning | work-loop capture gates | Capture receipt | Captured or recorded unavailable |

## Design (LLD)

### Design decisions

- **Firewall over Docker or CLI settings.** The CLI cannot request `127.0.0.1`, and Docker Desktop 4.68.0 ignores the network-level bind option (spec Assumptions). The firewall block on the serving program is the only setting that closes every stack port. Traces to: AC-0006, AC-0007, AC-0011.
- **Ask before a lost block reopens.** With automatic allow for downloaded signed software off, a Docker update that drops the block entry makes the Mac ask instead of letting Docker in. The check refuses while automatic allow is on. Traces to: AC-0013.
- **Check the serving program, not a fixed path.** The check finds which process listens on each published stack port and asks the firewall about that process's executable, as the kernel records it (`lsof -d txt`), not the name the process gives itself (`ps -o comm=`). Traces to: AC-0002, AC-0003.
- **Find the stack from the port the tests use.** The project label comes from the container that publishes the database port in `DB_URL`, and then every container with that label is checked. This ties the check to the stack the suites write to without parsing `supabase/config.toml`. Traces to: AC-0003, AC-0008.
- **Run at the guard's two call sites.** Playwright starts its web server before global setup, so the check also runs at Playwright config load; global setup covers Vitest. Playwright loads the config again in every worker process, so the check runs there too. It takes well under a second, and a refusal in a worker means the block changed mid-run, which still fails the run. No skip is added, because any skip would be a bypass (spec Ask first). Traces to: AC-0001, AC-0002.
- **Injected runner.** `localStackRefusal` receives `run(file, args)`, which returns stdout or `null` on any failure. Unit tests replay recorded outputs; the real runner uses `execFileSync` with no shell and a 10-second timeout. Traces to: AC-0004, AC-0005.

### Behavior & rules

Each output is matched exactly, line by line; anything that does not match a
rule below is unreadable. Checks run in this order, and the first failure
returns its message:

1. `platform !== "darwin"`: "The network check supports only macOS, so it cannot confirm that only this computer reaches the local Supabase stack."
2. `socketfilterfw --getglobalstate`: `Firewall is enabled. (State = 1)` or `(State = 2)` is on. `Firewall is disabled. (State = 0)` gives "The macOS firewall is off, so other devices can reach the local Supabase stack."
3. `socketfilterfw --getallowsigned`: the line `Automatically allow downloaded signed software DISABLED.` passes. `... ENABLED.` gives "The macOS firewall lets downloaded signed apps accept connections without asking, so a Docker update could reopen the local Supabase stack."
4. `docker ps --filter publish=<dbPort> --format '{{.Label "com.supabase.cli.project"}}'` must print exactly one line of letters, digits, `_`, `.`, or `-`.
5. `docker ps --filter label=com.supabase.cli.project=<name> --format '{{.Ports}}'`: each line is empty or a `, `-separated list. An entry with `->` must be `<host>:<port>-><port>/tcp`, where host is `0.0.0.0`, `[::]`, `127.0.0.1`, or `[::1]` and each port is an integer from 1 to 65535; it yields the first port. An entry without `->` must be `<port>/tcp` and is ignored. No yielded port gives "Found no port the local Supabase stack publishes, so the network check cannot confirm that only this computer reaches it."
6. For each yielded port, `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fp` prints `p<pid>` and `f<fd>` lines; each pid is a positive integer. A `null` result or no pid gives "Found no program serving port <port>, so ...".
7. For each pid, `lsof -a -p <pid> -d txt -Fn`: the first `n` line after the first `ftxt` line is the executable and must be an absolute path.
8. For each distinct executable, `socketfilterfw --getappblocked <path>`: exactly `Incoming connection to <path> is blocked.` passes; exactly `Incoming connection to <path> is permitted.` gives "The macOS firewall lets other devices reach <path>, which serves the local Supabase stack's port <port>."

Unreadable gives "Could not read <what>, so the network check cannot confirm that only this computer reaches the local Supabase stack." Every message then adds "Refusing to run." and ends with "See \"Keep the local stack on this Mac\" in docs/architecture/overview.md." Traces to: AC-0001 to AC-0005, AC-0008, AC-0013.

### Dependencies & integration

`/usr/libexec/ApplicationFirewall/socketfilterfw`, `docker`, and `lsof` are system or Docker Desktop tools already on this Mac; none is a package dependency. Rollout is in [Rollout](#rollout).

## Tasks

### T1: The check's decision is right for every state, proven by unit tests over recorded outputs

**Depends on:** none
**Touches:** test/network.ts, test/network.test.ts

**Tests:**
- `test/network.test.ts`, one test per refusal in Behavior & rules and one pass: AC-0001 (`State = 0`), AC-0002 (`is permitted`; the message names the path and port), AC-0003 (the API port served by a blocked executable, the analytics port by a second, permitted one), AC-0004 (`platform: "linux"`), AC-0005 (each command returning `null`; `State = 9`; a port range entry `0.0.0.0:54321-54322->8000-8001/tcp`; an `--getappblocked` line naming a different path), AC-0008 (no `->` entry; a port whose `lsof` prints no pid), AC-0013 (`... downloaded signed software ENABLED.`), and a pass with every executable blocked.
- Fixtures are outputs recorded on 2026-10-09: `Firewall is disabled. (State = 0)`; `Automatically allow built-in signed software ENABLED.` and `Automatically allow downloaded signed software ENABLED.`; `Incoming connection to /Applications/Docker.app/Contents/MacOS/com.docker.backend is permitted.`; the `docker ps` lines `meat-ops`, `0.0.0.0:54322->5432/tcp, [::]:54322->5432/tcp`, `8080/tcp`, and an empty line; the `lsof -Fp` lines `p48398` and `f171`; and the `lsof -d txt -Fn` lines `p48398`, `ftxt`, `n/Applications/Docker.app/Contents/MacOS/com.docker.backend`. T3 replaces the enabled, blocked, and disabled-allow strings with recorded output.
- `test/network.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0001: refuses when the macOS firewall is off" (AC-0001). sha256 `b9e12c0a1030574e1c03fb03169f79f0117e724d493319945053d5b7c8441f60`. Stub validation, 2026-10-09: the block was extracted from this file into a `git archive` copy of `HEAD` in scratch, outside the repository, and its sha256 taken from that extraction (the code lines plus one terminal newline).
  - **Compile:** with a placeholder `test/network.ts` declaring `localStackRefusal`, `tsc --noEmit -p tsconfig.json` exited 0.
  - **Red:** `vitest run` over the stub alone, with a config that has no global setup, exited 1 both ways. With the placeholder returning `null`, the assertion failed (`.toMatch() expects to receive a string, but got object`). With the placeholder removed, the module failed to load (`Failed to load url ./network.js`).
  - **Isolation:** the run went through `sandbox-exec` with all network denied; file-content reads denied except for the repository, the scratch copy, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, this user's `os.tmpdir()`, `/private/var/db/timezone`, `/private/var/db/dyld`, `/private/preboot`, `/Library/Preferences`, the root directory entry, and the system paths `/System`, `/usr`, `/private/etc`, and `/dev`; file writes denied except under the scratch copy, `os.tmpdir()`, `/dev/null`, and `/dev/tty`; and a 120-second `alarm`. Under the same profile, reading `~/.zshrc`, writing into the repository, and connecting to `127.0.0.1:54321` were each refused. Vitest ran as `node node_modules/vitest/vitest.mjs`. Its results-cache write under `node_modules/.vite` was refused after the run. The stub touches no database, so there are no test-harness side effects. The scratch copy was removed.

```ts
import { describe, expect, it } from "vitest";
import { localStackRefusal } from "./network.js";

const FW = "/usr/libexec/ApplicationFirewall/socketfilterfw";

function replay(outputs: Record<string, string>) {
  return (file: string, args: string[]): string | null => outputs[[file, ...args].join(" ")] ?? null;
}

describe("Local stack network check", () => {
  // STUB: AC-0001
  it("AC-0001: refuses when the macOS firewall is off", () => {
    const run = replay({ [`${FW} --getglobalstate`]: "Firewall is disabled. (State = 0)\n" });
    expect(localStackRefusal({ platform: "darwin", dbPort: 54322, run })).toMatch(/firewall is off/);
  });
});
```

**Approach:**
- Write `localStackRefusal({ platform, dbPort, run })` in `test/network.ts` following Behavior & rules, with small exact parsers for each output.
- Export a `realRunner` that calls `execFileSync(file, args, { encoding: "utf8", timeout: 10_000 })` and returns `null` on any throw, including `lsof`'s exit 1.

**Done when:** `npx vitest run test/network.test.ts` passes every test listed above.

### T2: Both runners run the check and pass with the block on, and the docs state the posture

**Depends on:** T1
**Touches:** test/global-setup.ts, playwright.config.ts, docs/architecture/overview.md, AGENTS.md, docs/specs/local-ports/notes/verification-ledger.md

**Tests:**
- no stub (goal-based): with the block on, `npm test` passes (AC-0006), and `npm run typecheck` passes.
- no stub (manual QA): with the block on, `nc -z -G 2 127.0.0.1 <port>` succeeds for every published stack port (AC-0009); the ports and results are recorded in the ledger.

**Approach:**
- In `test/global-setup.ts` and `playwright.config.ts`, right after `resolveStackEnv()`, call `localStackRefusal` with `process.platform`, the port from `DB_URL`, and `realRunner`, and throw the message when it is not `null`.
- In `docs/architecture/overview.md`, add the section `Keep the local stack on this Mac`: why (the CLI publishes on every interface, IPv4 and IPv6, and Docker Desktop cannot stop it), the four commands below run in the owner's own Terminal, what they cover (every Docker-published port on this Mac), the undo (`--unblockapp <path>`, `--setallowsignedapp on`, `--setglobalstate off`), the answer to give when the Mac asks whether Docker may accept incoming connections (Deny; loopback, the app, and the tests keep working), the accepted residual that the check runs only when tests run, and the loopback web-page path, open until [its follow-on intent](../product/intents/local-stack-loopback-web-pages.md) closes.

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Docker.app/Contents/MacOS/com.docker.backend
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --blockapp /Applications/Docker.app/Contents/MacOS/com.docker.backend
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setallowsignedapp off
```

- Rewrite the Network bullet's last sentence so "only this machine reaches sign-in" points to the section. Change the `private.operators` sentence to say no Data API client can read or change the list, and that Postgres itself answers only this Mac under the block, linking to the section's loopback note. Add every suite and harness file this change adds to the `test/` row.
- In `AGENTS.md` "Build and test commands", add one line: the tests also refuse unless the firewall block is on, linking to the overview section.

**Done when:** every T2 test above passes and its observations are in the ledger.

### T3: In one short window, each firewall state gives its refusal, and the phone shows the block holds for other devices

**Depends on:** T2
**Touches:** test/network.ts, test/network.test.ts, docs/specs/local-ports/notes/verification-ledger.md

**Tests:**
- no stub (manual QA), state 1, after the owner runs `--unblockapp <path>` (firewall on, Docker not blocked): `npm test` and `npm run test:e2e` each refuse with the AC-0002 message. The phone on the same Wi-Fi loads Studio at the Mac's IPv4 address and at one global IPv6 address (AC-0010). The phone on cellular data, Wi-Fi off, tries the same IPv6 address; the ledger records loaded or not, and this attempt is not part of the control.
- no stub (manual QA), state 2, after the owner runs `--setglobalstate off`: `npm test` and `npm run test:e2e` each refuse with the AC-0001 message.
- no stub (manual QA), state 3, after the owner runs `--setglobalstate on` and `--blockapp <path>`: the phone on the same Wi-Fi fails to load Studio at the IPv4 address (AC-0007) and the IPv6 address (AC-0011), and on cellular data fails at the IPv6 address. `npm test` passes again.
- no stub (manual QA), every exit: whether the window completes or stops, its last ledger entry shows the three `socketfilterfw` reads with the block on after the owner put it back, or, when the block itself failed, `supabase stop` run and no stack port listening. Nothing else runs between leaving state 3 or stopping and that entry.

**Approach:**
- Give the owner the IPv6 address in chat only. The ledger names it "a global IPv6 address of the Mac" and records the IPv4 address, which is private.
- Ask the owner to run each state's commands back to back in their own Terminal, so the ports are open only from state 1 to state 3.
- Record the real `--getglobalstate`, `--getappblocked`, and `--getallowsigned` lines in each state. If any differs from T1's fixtures, update the fixtures and parsers after the window has closed, then re-run `npx vitest run test/network.test.ts`.
- If a state 1 Wi-Fi load fails, the control is missing: the owner puts the block back, and T3 stops. If a state 3 load succeeds, the block does not hold: run `supabase stop`, confirm no stack port listens, and stop.

**Done when:** the ledger holds every T3 observation above, its last entry is the exit entry, and the block is on or the stack is stopped.

### T4: The local stack is rebuilt with no data kept, and the snippets folder Studio mounts is empty

**Depends on:** T3
**Touches:** docs/specs/local-ports/notes/verification-ledger.md

**Tests:**
- no stub (manual QA): after the rebuild, the volume list includes `supabase_db_meat-ops`, and `docker volume inspect` shows each listed volume created after the recorded start time (AC-0012).
- no stub (manual QA): `supabase_migrations.schema_migrations` lists exactly the files in `supabase/migrations/` (AC-0015).
- no stub (manual QA): `ls -A supabase/snippets` prints nothing (AC-0014).
- no stub (goal-based): `npm test` passes after the rebuild.

**Approach:**
- Run only after a T3 exit in which no state 3 load succeeded, whether T3 completed or stopped at state 1. After a failed block, the stack stays stopped and T4 waits for the owner's decision.
- Confirm no vitest or playwright process runs from any worktree, then ask the owner for the go-ahead.
- Record the start time, then run `supabase stop --no-backup` and `supabase start`, which applies the migrations. Then load the seed with `docker exec -i supabase_db_meat-ops psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql` and record its exit status.
- Tell the owner to re-create the owner account with the overview's steps if they use one locally, and that the other worktrees re-apply any migrations of their own with `supabase migration up`.
- If `supabase/snippets/` holds a file, show the owner its name and leave it (spec Ask first).

**Done when:** every T4 test above passes and its observations are in the ledger.

## Rollout

- **Delivery:** the owner turned the block on in their own Terminal on 2026-10-09. T3 opens one short window and closes it. The undo is in the overview section. The one irreversible step is T4's `supabase stop --no-backup`, which deletes the shared stack's data; the owner accepted that (spec Assumptions).
- **Infrastructure:** the macOS application firewall on the developer's Mac. No hosted change.
- **External-system integration:** Docker Desktop 4.68.0 and Supabase CLI 2.95.4 as installed; neither is changed.
- **Deployment sequencing:** the check lands (T1, T2) before the window (T3), so every refusal comes from the shipped code. The rebuild (T4) comes after the window closes with the block holding, so nothing reaches the rebuilt stack from outside; after a failed block, nothing restarts the stack until the owner decides.

## Risks

- A Docker Desktop update could replace `com.docker.backend` and lose its firewall entry. With automatic allow off, the Mac asks before letting it in, and the next test run refuses.
- Other apps that accept incoming connections may ask once now that automatic allow is off. The app and tests listen on `127.0.0.1` only.
- The home Wi-Fi may keep devices from reaching each other, or the phone may lack IPv6. Then the state 1 control fails and T3 stops, which is the point of the control.
- The rebuild clears the test data of the other worktrees that share the stack and would break a test run of theirs in progress. Hence the process check and the owner's go-ahead.
- Other projects' Docker ports on this Mac (`mobilize-postgres`, `mobilize-redis`, `inbox-concierge`'s stack) become unreachable from other devices too. The owner accepted this.

## Changelog

- 2026-10-09: initial plan, after the owner chose the firewall block when the Docker setting probe failed.
- 2026-10-09: revised after review round 1: the check also runs at Playwright config load; it reads each listener's executable through `lsof`, checks automatic allow, and refuses on any inexact output; T3 adds the phone control loads, IPv6, and cellular in one short window; T4 adds the leftovers check; the docs plan covers the `test/` row and `AGENTS.md`.
- 2026-10-09: revised after review round 2: every window exit restores the block or stops the stack; the config-load check skips in Playwright workers; messages end with the overview pointer; T4 rebuilds the stack instead of a read-only check, as the owner chose.
- 2026-10-09: revised after review round 3: the rebuild runs only if the block held and loads the seed through psql; the worker skip is dropped; the window's exit rule names the owner; the overview notes the loopback path.
