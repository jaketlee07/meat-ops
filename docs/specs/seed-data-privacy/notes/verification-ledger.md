# Verification ledger: seed-data-privacy

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/67db4740-1cf1-4938-b921-fa8377b7ee9d/`.

## Owner decisions (2026-10-20)

- The local backstop's lines go just above the `# claude-code-runtime` header in this folder's `info/exclude`, so a rewrite of that tool-written block cannot remove them. This settles round-2 security finding 1, which the adjudicator left indeterminate because no source shows whether that block's writer rewrites the lines after it.
