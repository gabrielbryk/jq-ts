---
'@gabrielbryk/jq-ts': patch
---

Fix several builtins to match jq 1.8 output exactly. These divergences were
uncovered by a large batch of new differential fixtures (run against the real
jq binary) for previously self-asserted builtins:

- `round` now rounds half away from zero (jq semantics) instead of JavaScript's round-half-toward-+∞.
- `sqrt` of a negative number now yields `null` (as jq does) instead of `NaN`.
- Corrected float classification (`isnan`, `isfinite`, `isinfinite`, `isnormal`), `min_by`/`max_by` (tie and empty-array handling), `toboolean`, `getpath`, `index`/`rindex`/`indices`, `limit`, `nth`, and a comparison-operator edge case to match jq.
