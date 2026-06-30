import type { BuiltinSpec } from '../types'
import { captureBuiltins } from './capture'
import { matchBuiltins } from './match'
import { splitBuiltins } from './split'
import { subBuiltins } from './sub'

/**
 * jq's Oniguruma-backed regex builtins, implemented on the pure-TS linear regex
 * engine in `src/regex`: `test`, `match`, `capture`, `scan`, `splits`, the
 * 2-arg regex `split`, and `sub`/`gsub`.
 */
export const regexBuiltins: BuiltinSpec[] = [
  ...matchBuiltins,
  ...captureBuiltins,
  ...splitBuiltins,
  ...subBuiltins,
]
