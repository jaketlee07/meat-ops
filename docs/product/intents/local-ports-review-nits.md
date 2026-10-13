# Network check program-lookup test

- **Status:** Draft


## Outcome

Every rule the network check applies to its program lookup can turn a test red when it breaks, including the rules for the file entries after the first.

## Boundary

- `localStackRefusal` in test/network.ts refuses the output of `lsof -a -p <pid> -d txt -Fn` unless every pair after the pid line is `ftxt` followed by an absolute path.
- Every malformed program-lookup case in test/network.test.ts (lines 219 to 236 at 1258b07) breaks the first pair, so a parser that checked only the first pair would stay green.
- The executable comes from the first pair either way, so the firewall decision does not change. Only the proof that unrecognized output refuses is missing for the later pairs.

## Owner

- jaketlee07

## Unresolved questions

- None.

## Projection

- A direct-light change: one or two cases with a valid first pair and a broken later pair (a label other than `ftxt`, or a path that is not absolute), each expecting the "Could not read the program serving port" refusal.


## Source

- Mode: repo-origin
- Locator: docs/specs/local-ports/notes/verification-ledger.md
- Revision: 1258b07
- Authority: repo-origin
