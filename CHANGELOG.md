# jq-ts

## 1.7.0

### Minor Changes

- 5c1bda8: Add the `@`-format string filters and the standard math builtins.
  - **`@`-formats:** `@text`, `@json`, `@base64`/`@base64d`, `@base32`/`@base32d`, `@uri`, `@csv`, `@tsv`, `@sh`, `@html`, including the interpolation form `@base64 "v=\(.x)"` (the format is applied to each interpolated value). Encoders are pure TypeScript (no host APIs). `@json` uses jq-ts's deterministic sorted-key stringification, so it can differ from jq on object key order.
  - **Math:** trigonometric (`sin`/`cos`/`tan`/`asin`/`acos`/`atan`/`atan2`), hyperbolic (`sinh`/`cosh`/`tanh`/`asinh`/`acosh`/`atanh`), exponential/log (`exp`/`expm1`/`exp2`/`exp10`/`log`/`log2`/`log10`/`log1p`/`pow`/`cbrt`/`hypot`), and simple float ops (`fabs`/`trunc`/`fmin`/`fmax`/`fmod`/`copysign`). These map to JavaScript's `Math`; transcendental results may differ from jq's C `libm` in the last ULP. Gamma/Bessel/erf and rounding-mode functions remain unsupported.

- 8bbc74c: Harden the regex engine and add POSIX classes + absolute anchors.
  - **Strict rejection (correctness/safety fix):** unsupported regex constructs now throw a clear `unsupported regex feature` error instead of silently degrading to a literal match. This closes a hole where `\g1`/`\g<1>`, Unicode property escapes (`\p{…}`, `\pL`), Oniguruma special escapes (`\h \H \R \K \G`, `\b{…}`), and unknown alphanumeric escapes were silently accepted and matched incorrectly. A rejection test battery guards against regressions.
  - **POSIX bracket classes:** `[[:alpha:]]`, `[[:digit:]]`, `[[:alnum:]]`, `[[:space:]]`, `[[:upper:]]`, `[[:lower:]]`, `[[:punct:]]`, `[[:xdigit:]]`, `[[:blank:]]`, `[[:cntrl:]]`, `[[:graph:]]`, `[[:print:]]`, `[[:word:]]`, and their negations, composable inside character classes (ASCII semantics, like the engine's `\d`/`\w`/`\s`).
  - **Absolute anchors:** `\A` (start of input), `\z` (end of input), `\Z` (end, or before a single trailing newline).

- 91da082: Add regex support: `test`, `match`, `capture`, `scan`, `sub`, `gsub`, the 2-argument regex `split`, and `splits`, with the `g i m s x` flags.

  Matching runs on a new pure-TypeScript, dependency-free **linear-time engine** (Thompson NFA + Pike VM), so it is ReDoS-immune — unbounded backtracking can't be used as a compute bomb against untrusted expressions. Match offsets/lengths are reported in Unicode codepoints, matching jq, and `sub`/`gsub` evaluate their replacement as a filter over the named-capture object, as in jq.

  Backreferences, lookahead/lookbehind, atomic groups, and possessive quantifiers are intentionally rejected (incompatible with linear-time matching); jq's Oniguruma engine allows them.

- 069dd41: Add the streaming builtins and SQL-style helpers.
  - **Streaming:** `tostream`, `fromstream(f)`, and `truncate_stream(f)` (depth taken from the input, as in jq) — the streamed `[path, leaf]` / close-event representation and its inverse.
  - **SQL-style:** `INDEX(idx_expr)`, `INDEX(stream; idx_expr)`, `IN(s)`, and `IN(source; s)`. (`INDEX` builds an object, so jq-ts's deterministic sorted-key behavior applies.)

  These are the last of the broadly-useful builtin gaps; the remaining unimplemented jq builtins are the niche C-libm math functions (gamma/Bessel/erf) and intentionally-excluded I/O/module features.

## 1.6.0

### Minor Changes

- a7efc8a: Add `$ARGS` support. `$ARGS.named` is populated from the caller-provided `options.vars`, and a new `positionalArgs` option backs `$ARGS.positional` (defaults to `[]`). jq-ts never reads process argv — these values come only from the options you pass to `run`.

### Patch Changes

- 949de03: Fix several builtins to match jq 1.8 output exactly. These divergences were
  uncovered by a large batch of new differential fixtures (run against the real
  jq binary) for previously self-asserted builtins:
  - `round` now rounds half away from zero (jq semantics) instead of JavaScript's round-half-toward-+∞.
  - `sqrt` of a negative number now yields `null` (as jq does) instead of `NaN`.
  - Corrected float classification (`isnan`, `isfinite`, `isinfinite`, `isnormal`), `min_by`/`max_by` (tie and empty-array handling), `toboolean`, `getpath`, `index`/`rindex`/`indices`, `limit`, `nth`, and a comparison-operator edge case to match jq.

## 1.5.0

### Minor Changes

- 8b58af6: Implement the jq date/time builtins: `now`, `gmtime`, `localtime`, `mktime`, `strftime`, `strflocaltime`, `strptime`, `todate`, `todateiso8601`, `fromdate`, and `fromdateiso8601`.

  These match the jq 1.8 binary, including the broken-down time array layout `[year, month, mday, hour, min, sec, wday, yday]`, fractional seconds, the `%V`/`%G`/`%u`/`%I`/`%p` strftime specifiers, and `strftime`/`strflocaltime` accepting either a broken-down array or an epoch number.

  `now` is clock-injectable via the new `EvalOptions.now` option (a `Date` or epoch seconds) and throws when no clock is supplied, so jq-ts never reads the host clock on its own and date programs stay deterministic. The other date builtins are pure functions of their input.

## 1.4.0

### Minor Changes

- 0cb187f: Expand jq compatibility for common pure builtins and arities, including `map_values`, `in`, `del`, `pick`, `tojson`, `fromjson`, trim helpers, type filters, `paths(filter)`, `add(generator)`, additional `all`/`any`/`first`/`last`/`nth`/`recurse` forms, jq comments, and destructuring bindings.

## 1.3.6

### Patch Changes

- 3a34917: fix: address gaps in `not` builtin and robust array indexing.
  - Implemented `not` as a builtin and updated parser to allow it in filter positions.
  - Improved array indexing to support float truncation and better parity with standard `jq`.

## 1.3.5

### Patch Changes

- 39ee325: Support piped assignments and missing path nodes (Var, Slice, Try) in assignments.

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
