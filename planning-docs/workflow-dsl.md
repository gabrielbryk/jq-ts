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

- any I/O or environment-dependent behavior (reading inputs/files/env; debug side effects)
- module loading from disk (`import/include`)

`now` is available but only resolves to a clock the host injects (`EvalOptions.now`); it throws otherwise, so the engine never reads the system clock. A host that wants fully time-independent expressions can simply leave `now` uninjected.

Everything else is gated by validator + execution limits to keep user-supplied expressions safe.

### What to prioritize early

- **Safe extraction + defaults**: `.foo?`, `.[expr]?`, `//`
- **Boolean logic**: `and/or/not`, comparisons, `if/then/else`
- **Collection transforms**: `.[]`, `map(f)`, `select(f)`, object/array construction
- **Basic utilities**: `length`, `type`, `tostring`, `tonumber`, `keys`, `has`

### What to explicitly reject

- `import` / `include`
- external I/O builtins (`input`, `inputs`, and any equivalent)

(`now` is gated by clock injection rather than rejected — see above.)
