# Requirements

## Runtime constraints (isolate-safe runtime)

- Must run in a V8 isolate with strict determinism requirements.
- Must not depend on Node.js built-ins (`fs`, `path`, `child_process`, etc.).
- Must not use network or filesystem at runtime.
- Must avoid non-deterministic sources (random, locale/timezone-dependent behavior). Time is never read from the host clock; it is available only through a caller-injected instant (`EvalOptions.now`).

## User-supplied expressions

- Expressions are user-supplied; we will **only execute an allowed subset**.
- Expressions may be embedded (e.g., `${ ... }`) in another DSL; we evaluate just the expression body.
- Inputs are JSON-like values (object/array/string/number/boolean/null).
- The engine must provide:
  - Parsing with good error messages (location/range).
  - Static validation: reject expressions using unsupported syntax or disallowed builtins.
  - Safe execution limits: cap compute and output to protect the host from runaway expressions.

## Compatibility contract

We target “jq language semantics” (filter → stream of values) with the following explicit deviations:

- The `now` builtin requires a caller-injected instant (`EvalOptions.now`) and throws at runtime when none is provided; jq-ts never reads the host clock on its own.
- No I/O builtins that read external input (`input`, `inputs`, etc.).
- No module loading from disk (`import`, `include`); inline expressions don’t require external `.jq` module files.

## Determinism rules

- No access to the host clock, locale-specific formatting, or randomness. Time enters only through the injected `now` instant; date builtins are otherwise pure functions of their input.
- All iteration and ordering must be well-defined. If jq leaves ordering unspecified, we choose a deterministic convention and document it.
