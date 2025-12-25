---
'@gabrielbryk/jq-ts': patch
---

fix: address gaps in `not` builtin and robust array indexing.

- Implemented `not` as a builtin and updated parser to allow it in filter positions.
- Improved array indexing to support float truncation and better parity with standard `jq`.
