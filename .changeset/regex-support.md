---
'@gabrielbryk/jq-ts': minor
---

Add regex support: `test`, `match`, `capture`, `scan`, `sub`, `gsub`, the 2-argument regex `split`, and `splits`, with the `g i m s x` flags.

Matching runs on a new pure-TypeScript, dependency-free **linear-time engine** (Thompson NFA + Pike VM), so it is ReDoS-immune — unbounded backtracking can't be used as a compute bomb against untrusted expressions. Match offsets/lengths are reported in Unicode codepoints, matching jq, and `sub`/`gsub` evaluate their replacement as a filter over the named-capture object, as in jq.

Backreferences, lookahead/lookbehind, atomic groups, and possessive quantifiers are intentionally rejected (incompatible with linear-time matching); jq's Oniguruma engine allows them.
