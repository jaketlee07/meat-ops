# Verification ledger: zero-stock-average

Execution observations, newest last. Each entry names the task, the command,
and the observed result. Work runs in the `meat-ops` folder on this Mac
(Node 22.17.0), on stack B.

## Gates before EXECUTE

- Pre-EXECUTE reviews closed after four rounds on 2026-10-18. Raw and adjudication artifacts are under the ignored `.context/reviews/04390e72-bb6f-4404-ae44-9b4ebd36cbc9/`, with round dispositions in `dispositions.md` there.
  - adversarial-reviewer: 11 findings in round 1 and 3 in round 2, of which adjudication sustained 7 and 2, all advisory or nit; byte-exact Clean in rounds 3 and 4.
  - shaping-reviewer: 7 findings and 2 advisories in round 1, 2 findings and 1 advisory in round 2, 1 finding in round 3, all repaired; Clean in round 4.
- The owner's decisions of 2026-10-18 are in the spec's Assumptions.
- The owner approved the spec, then the plan, in chat. `approve-plan` recorded the baseline and `schedule` set three waves: T1; T2; T3, T4, and T5. `plan-locked` fires at the start of T1, which waits for the corrections merge into `main`.
- `lint-contract-item-alignment.py` reports 7 references that resolve to no criterion in this folder: the corrections spec's AC-0025 and AC-0066 and foundation-hardening's AC-0029 and AC-0053, each named beside its spec.
- This folder ran `npm ci` on 2026-10-18, after `main`'s lockfile added the Anthropic SDK. The T2 stub's red run and the formula probe used stack B, which held `main`'s ten migrations; the probe rolled back.
- Project-knowledge capture is not attempted at the gates; the store refused captures in earlier sessions (`staged_dual_writer`). Reusable lessons go to the session memory.
