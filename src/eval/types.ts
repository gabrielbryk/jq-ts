import type { LimitsConfig } from '../limits'
import type { Value } from '../value'

export type { EnvFrame, EnvStack, Evaluator, FunctionDef } from '../types'

/**
 * Options passed to the evaluator.
 */
export interface EvalOptions {
  limits?: LimitsConfig
  /**
   * Predefined variables to seed the global environment.
   * Keys are variable names without the '$' prefix.
   */
  vars?: Record<string, Value>
  /**
   * The wall-clock instant the `now` builtin resolves to — a `Date` or seconds
   * since the Unix epoch. When omitted, `now` throws (jq-ts never reads the
   * host clock on its own). Pure date builtins (`gmtime`, `strftime`, `todate`,
   * …) are unaffected.
   */
  now?: Date | number
}
