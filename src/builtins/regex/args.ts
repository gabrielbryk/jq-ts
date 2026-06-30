import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Span } from '../../span'
import { describeType, type Value } from '../../value'
import type { Evaluator } from '../types'

/** A resolved (regex, flags) pair to compile and run. */
export interface RegexArgs {
  re: Value
  flags: Value
}

/** Unpacks the 1-arg form: a string regex, or a `[re, flags]` array. */
const unpackSingle = (val: Value, span: Span): RegexArgs => {
  if (typeof val === 'string') return { re: val, flags: null }
  if (Array.isArray(val)) {
    if (val.length > 1) return { re: val[0] ?? null, flags: val[1] ?? null }
    if (val.length > 0) return { re: val[0] ?? null, flags: null }
  }
  throw new RuntimeError(`${describeType(val)} not a string or array`, span)
}

/**
 * Resolves the regex builtin arguments into a stream of (re, flags) pairs.
 *
 * The 1-arg form (`args.length === 1`) accepts jq's `[re, flags]` array; the
 * 2-arg form evaluates the regex and flags filters and yields their cross
 * product, matching jq's generator semantics.
 */
export function* resolveArgs(
  args: FilterNode[],
  input: Value,
  env: EvalEnv,
  tracker: LimitTracker,
  evaluate: Evaluator,
  span: Span
): Generator<RegexArgs> {
  if (args.length === 1) {
    for (const val of evaluate(args[0]!, input, env, tracker)) {
      yield unpackSingle(val, span)
    }
    return
  }
  for (const re of evaluate(args[0]!, input, env, tracker)) {
    for (const flags of evaluate(args[1]!, input, env, tracker)) {
      yield { re, flags }
    }
  }
}

/** Local alias for the evaluator's env-stack parameter. */
type EvalEnv = Parameters<Evaluator>[2]
