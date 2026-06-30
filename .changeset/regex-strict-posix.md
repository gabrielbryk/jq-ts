---
'@gabrielbryk/jq-ts': minor
---

Harden the regex engine and add POSIX classes + absolute anchors.

- **Strict rejection (correctness/safety fix):** unsupported regex constructs now throw a clear `unsupported regex feature` error instead of silently degrading to a literal match. This closes a hole where `\g1`/`\g<1>`, Unicode property escapes (`\p{…}`, `\pL`), Oniguruma special escapes (`\h \H \R \K \G`, `\b{…}`), and unknown alphanumeric escapes were silently accepted and matched incorrectly. A rejection test battery guards against regressions.
- **POSIX bracket classes:** `[[:alpha:]]`, `[[:digit:]]`, `[[:alnum:]]`, `[[:space:]]`, `[[:upper:]]`, `[[:lower:]]`, `[[:punct:]]`, `[[:xdigit:]]`, `[[:blank:]]`, `[[:cntrl:]]`, `[[:graph:]]`, `[[:print:]]`, `[[:word:]]`, and their negations, composable inside character classes (ASCII semantics, like the engine's `\d`/`\w`/`\s`).
- **Absolute anchors:** `\A` (start of input), `\z` (end of input), `\Z` (end, or before a single trailing newline).
