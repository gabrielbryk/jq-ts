---
'@gabrielbryk/jq-ts': minor
---

Add the `@`-format string filters and the standard math builtins.

- **`@`-formats:** `@text`, `@json`, `@base64`/`@base64d`, `@base32`/`@base32d`, `@uri`, `@csv`, `@tsv`, `@sh`, `@html`, including the interpolation form `@base64 "v=\(.x)"` (the format is applied to each interpolated value). Encoders are pure TypeScript (no host APIs). `@json` uses jq-ts's deterministic sorted-key stringification, so it can differ from jq on object key order.
- **Math:** trigonometric (`sin`/`cos`/`tan`/`asin`/`acos`/`atan`/`atan2`), hyperbolic (`sinh`/`cosh`/`tanh`/`asinh`/`acosh`/`atanh`), exponential/log (`exp`/`expm1`/`exp2`/`exp10`/`log`/`log2`/`log10`/`log1p`/`pow`/`cbrt`/`hypot`), and simple float ops (`fabs`/`trunc`/`fmin`/`fmax`/`fmod`/`copysign`). These map to JavaScript's `Math`; transcendental results may differ from jq's C `libm` in the last ULP. Gamma/Bessel/erf and rounding-mode functions remain unsupported.
