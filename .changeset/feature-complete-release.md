---
'jq-ts': minor
---

**First Feature-Complete Release (1.1.0)**

- **Core Language**: Full support for pipes `|`, comma `,`, object/array construction, field/index access, and variable binding `as $var`.
- **Control Flow**: `if-then-else`, `reduce`, `foreach`, `try-catch`, and `error`.
- **Advanced Operators**: Recursive descent `..`, alternative `//`, and `?` error suppression.
- **Builtins**:
  - Types: `type`, `tostring`, `tonumber`, `length`.
  - Objects/Arrays: `keys`, `has`, `map`, `select`, `sort` (stable), `unique`, `to_entries`, `with_entries`.
  - Strings: `split`, `join`, `startswith`, `endswith`, `contains`.
  - Paths: `paths`, `getpath`, `setpath`, `delpaths` (immutable).
- **Determinism**: Guaranteed stable object key ordering and predictable execution limits for workflow safety.
