# Verification ledger: polish-forms-alerts

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/66ead429-0279-4602-ad5e-19d0896a98a3/`.

## Owner decisions (2026-11-09)

The spec's Assumptions record each of these as a Product line:

- The urgent banner becomes a slim, quiet bar, and the red badge on the Alerts links stays.
- Receiving's saved result always starts right under the form, which retires the limit accepted on 2026-11-05.
- Every form uses one label style: 14 px, `--color-ink-secondary`, weight 500.
- Only neighboring number fields share a line. Vendor keeps its own line, so Tab order stays as it is. Customer and Sale date keep their own lines, chosen after a phone's half-line was found to cut "Fulton Market Deli".
- The digest shows each paragraph as its own list item with a gray dot; the model and the stored text stay as they are.
- Ask uses the full content width.
- The photo picker shows a "Choose photo" button and the chosen file's name, or "No photo chosen".
- The read cards on `/invoices` drop their reserved status line, so a read in flight grows its card by the reading message's height and moves down whatever sits below that card.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 (at `4e7e5d3`) | 16 findings: 10 sustained and accepted, 5 refuted, 1 indeterminate | 12 findings, all accepted |
| 2 (delta `4e7e5d3..dfee0d9`) | 6 findings: 4 sustained and accepted, 2 refuted | 8 findings, all accepted |

- Round 1's indeterminate adversarial finding asked how much room a date box's text keeps once the calendar icon is in place. Two throwaway Chromium probes on 2026-11-09 answered it: with 12 px left padding and 40 px right padding for the icon, 11/09/2026 shows whole from a 102 px content box (156 px overall) and is cut at 98 px; `getComputedStyle` does not report the styled `::-webkit-calendar-picker-indicator`; and `elementFromPoint` at the icon's center returns the date box. The owner chose on 2026-11-09 to proceed to round 2 with the probes as the evidence.
- Round 1 refuted (no change): finding 5 (keyboard presses fall under AC-0020's unqualified "second press"), 11 (the digest's 45rem width is held by the overview and AC-0029), 13 (the Always-do bullet keeps every role, the empty live regions included), 14 (keeping or removing the shell's unused cap is a build-time choice), and 16 (Receiving and Sales show money at two decimals in their price lines).
- Round 2 refuted (no change): finding 3 (a dialog reopened after a refused request gives AC-0033's Cancel a press with nothing waiting, which the plan now names) and 6 (AC-0031 already covers the keyboard-only test's photo focus step, which T2 now names too). A third Chromium probe on 2026-11-09 showed that hiding `::-webkit-calendar-picker-indicator` with an injected rule leaves a correctly styled date box's screenshot identical and changes one that still draws the icon, and that a text box's scroll width shows a cut value (100 against 76).
