# Embedding jq-ts in host DSLs

This library is often embedded as an expression engine inside other DSLs (for example, `${ ... }` envelopes in config files). We evaluate only the expression body.

## Implications for jq support

Because expressions are embedded inline:

- Module files (`import` / `include`) are unnecessary and remain unsupported.
- Prioritize features that help with:
  - extracting nested values safely
  - shaping data (arrays/objects)
  - boolean conditions
  - mapping/filtering collections
  - defaults when data is missing

## Recommended target

Support as much of jq as possible **except**:

- non-deterministic builtins (e.g., `now`)
- any I/O or environment-dependent behavior (reading inputs/files/env; debug side effects)
- module loading from disk (`import/include`)

Everything else is gated by validator + execution limits to keep user-supplied expressions safe.

### What to prioritize early

- **Safe extraction + defaults**: `.foo?`, `.[expr]?`, `//`
- **Boolean logic**: `and/or/not`, comparisons, `if/then/else`
- **Collection transforms**: `.[]`, `map(f)`, `select(f)`, object/array construction
- **Basic utilities**: `length`, `type`, `tostring`, `tonumber`, `keys`, `has`

### What to explicitly reject

- `now`
- `import` / `include`
- external I/O builtins (`input`, `inputs`, and any equivalent)
