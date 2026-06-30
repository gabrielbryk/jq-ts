---
'@gabrielbryk/jq-ts': minor
---

Add the streaming builtins and SQL-style helpers.

- **Streaming:** `tostream`, `fromstream(f)`, and `truncate_stream(f)` (depth taken from the input, as in jq) — the streamed `[path, leaf]` / close-event representation and its inverse.
- **SQL-style:** `INDEX(idx_expr)`, `INDEX(stream; idx_expr)`, `IN(s)`, and `IN(source; s)`. (`INDEX` builds an object, so jq-ts's deterministic sorted-key behavior applies.)

These are the last of the broadly-useful builtin gaps; the remaining unimplemented jq builtins are the niche C-libm math functions (gamma/Bessel/erf) and intentionally-excluded I/O/module features.
