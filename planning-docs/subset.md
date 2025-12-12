# Supported subset

We want a **maximal jq subset** that remains deterministic and isolate-safe for embedded use (e.g., in other DSLs).

## Support target

### Explicit exclusions (determinism/safety)

We aim to support “as much jq as possible” except:

- `now` (non-deterministic)
- external modules via `.jq` files (`import` / `include`)
- external I/O / environment access (`input`, `inputs`, and any equivalent)

Everything else is on the table, gated by validation + execution limits.

## v0: “Initial subset”

Expressions may be embedded as `${ ... }` in host DSLs. The engine evaluates the expression body against the current context as `.`.

### Syntax (planned for v0)

- Literals: `null`, `true`, `false`, numbers, strings
- Identity: `.`
- Field/index:
  - `.foo`, `."foo bar"`, `.[0]`, `.[expr]`
  - Optional access: `.foo?`, `.[0]?`
- Arrays/objects:
  - `[expr, ...]`
  - `{key: value, ...}` and computed keys `{(expr): value}`
- Composition:
  - Pipe: `a | b`
  - Comma: `a, b`
  - Parentheses
- Conditionals: `if a then b elif c then d else e end`
- Boolean ops: `and`, `or`, `not`
- Comparisons: `== != < <= > >=`
- Arithmetic: `+ - * / %` and unary `-`
- Alternative: `a // b`
- Simple binding: `expr as $x | ...`
- Function definitions (inline): `def name(args): expr;` (no module system)
- Error handling: `try a catch b`

### Builtins (planned for v0)

Start with common, deterministic builtins:

- Type and conversion: `type`, `tostring` (deterministic key order), `tonumber`, `length`, `keys` (sorted), `has`
- Collections: `map(f)`, `select(f)`, `sort` (stable), `sort_by(f)` (stable), `unique` (preserve order), `unique_by(f)` (preserve order)
- Object/array transforms: `to_entries` (sorted keys), `from_entries`, `with_entries(f)`
- Strings: `split`, `join` (strict string input), `startswith`, `endswith`, `contains` (recursive)

## v1: “Maximal deterministic jq”

Once the MVP is stable, expand language support toward jq parity (still excluding the safety exclusions above):

### Additional syntax/features (v1 candidates)

- `reduce` / `foreach`
- Recursive descent `..`
- Path/update operations: `path`, `paths`, `getpath`, `setpath`, `delpaths`
- Assignment/update operators: `=`, `|=`, `+=`, etc. (where semantics are well-defined)
- Richer patterns for `as $var` bindings (destructuring)

### Builtins expansion (v1 candidates)

- More string/array/object utilities from jq
- Regex features (only with deterministic behavior guarantees)
- Encoding/format filters (`@json`, `@csv`, etc.) with deterministic escaping

## Validation model

We will implement:

1. Parse → AST
2. Validate:
   - all AST node types supported
   - all called builtins supported and allowed
   - all operators supported
3. Compile (optional) or interpret

## Why we don’t need external modules

Expressions are evaluated inline; authors can still use inline `def ...;` to structure complex expressions without relying on separate `.jq` module files.
