# jq-ts

## 1.3.4

### Patch Changes

- f641384: Fix string interpolation to not JSON-quote strings that are already strings, matching standard jq behavior.

## 1.3.3

### Patch Changes

- d6545b0: fix: treat null as additive identity for all types

## 1.3.2

### Patch Changes

- d703c4a: Implement predefined variables support and fix iterator scoping for correct variable shadowing.

## 1.3.1

### Patch Changes

- 77b185a: feat(parser): add support for object shorthand syntax {id, name}

## 1.3.0

### Minor Changes

- 9a66b17: feat: Implement assignment operators (=, |=, +=, etc) and extensive builtins (collections, strings, iterators). Added comprehensive compatibility tests.

## 1.2.0

### Minor Changes

- 87c3e3d: Refactor evaluation logic, add comprehensive TSDocs, and fix complex jq features (slice, try-catch).

## 1.1.0

### Minor Changes

- e59809c: **First Feature-Complete Release (1.1.0)**
  - **Core Language**: Full support for pipes `|`, comma `,`, object/array construction, field/index access, and variable binding `as $var`.
  - **Control Flow**: `if-then-else`, `reduce`, `foreach`, `try-catch`, and `error`.
  - **Advanced Operators**: Recursive descent `..`, alternative `//`, and `?` error suppression.
  - **Builtins**:
    - Types: `type`, `tostring`, `tonumber`, `length`.
    - Objects/Arrays: `keys`, `has`, `map`, `select`, `sort` (stable), `unique`, `to_entries`, `with_entries`.
    - Strings: `split`, `join`, `startswith`, `endswith`, `contains`.
    - Paths: `paths`, `getpath`, `setpath`, `delpaths` (immutable).
  - **Determinism**: Guaranteed stable object key ordering and predictable execution limits for workflow safety.

## 1.0.1

### Patch Changes

- a74fc06: initial
