---
'@gabrielbryk/jq-ts': minor
---

Add `$ARGS` support. `$ARGS.named` is populated from the caller-provided `options.vars`, and a new `positionalArgs` option backs `$ARGS.positional` (defaults to `[]`). jq-ts never reads process argv — these values come only from the options you pass to `run`.
