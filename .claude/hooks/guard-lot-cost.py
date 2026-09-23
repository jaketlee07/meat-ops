#!/usr/bin/env python3
"""PreToolUse guard: block any attempt to overwrite lots.unit_cost.

Reads the hook payload on stdin. Inspects Bash commands and written or edited
file content. If it finds an UPDATE to lots that assigns unit_cost, it exits 2,
which denies the tool call and surfaces the reason to Claude. Legitimate updates
to lots (for example SET remaining_lbs) are not blocked. Fails open on any parse
error so the session is never bricked by this guard.
"""
import json
import re
import sys

# update ... lots ... unit_cost =   (case and whitespace insensitive)
PATTERN = re.compile(r"\bupdate\b\s+\blots\b.*?\bunit_cost\b\s*=", re.IGNORECASE | re.DOTALL)


def main() -> int:
    raw = sys.stdin.read()
    haystack = raw  # fallback: always scan the raw payload too
    try:
        ti = (json.loads(raw) or {}).get("tool_input", {}) or {}
        haystack += " " + " ".join(
            str(ti.get(k, ""))
            for k in ("command", "content", "new_string", "new_str", "text")
        )
    except Exception:
        pass  # keep scanning raw; do not brick the session on a parse error

    if PATTERN.search(haystack):
        sys.stderr.write(
            "Blocked: this modifies lots.unit_cost. Lot cost is immutable "
            "(see CLAUDE.md and docs/costing.md). Rising costs must create a "
            "NEW lot via receive_lot, not overwrite an existing one.\n"
        )
        return 2  # deny the tool call

    return 0


if __name__ == "__main__":
    sys.exit(main())
