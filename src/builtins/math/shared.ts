import { RuntimeError } from '../../errors'
import { compareValues, type Value } from '../../value'
import type { BuiltinSpec } from '../types'

/** Smallest positive normal IEEE-754 double. */
export const MIN_NORMAL_DOUBLE = 2.2250738585072014e-308

/** Returns true when input is a non-zero finite number above the subnormal threshold. */
export const isNormalNumber = (input: Value): boolean =>
  typeof input === 'number' &&
  Number.isFinite(input) &&
  input !== 0 &&
  Math.abs(input) >= MIN_NORMAL_DOUBLE

export type EvaluateFn = Parameters<BuiltinSpec['apply']>[4]
export type Tracker = Parameters<BuiltinSpec['apply']>[3]
export type Env = Parameters<BuiltinSpec['apply']>[2]
export type Args = Parameters<BuiltinSpec['apply']>[1]
export type Span = Parameters<BuiltinSpec['apply']>[5]

export const lt = (cmp: number): boolean => cmp < 0
export const gt = (cmp: number): boolean => cmp > 0
export const gte = (cmp: number): boolean => cmp >= 0

/** Evaluate a key expression that must produce exactly one value. */
const evalSingleKey = (
  evaluate: EvaluateFn,
  args: Args,
  item: Value,
  env: Env,
  tracker: Tracker,
  span: Span,
  label: string
): Value => {
  const keys = Array.from(evaluate(args[0]!, item, env, tracker))
  if (keys.length !== 1) throw new RuntimeError(`${label} key must return one value`, span)
  return keys[0]!
}

/** Pick the item whose key comparison against the running best key satisfies `keep`. */
export const pickExtremeBy = (
  input: Value[],
  keep: (cmp: number) => boolean,
  evaluate: EvaluateFn,
  args: Args,
  env: Env,
  tracker: Tracker,
  span: Span,
  label: string
): Value => {
  let bestItem = input[0]!
  let bestKey = evalSingleKey(evaluate, args, bestItem, env, tracker, span, label)
  for (let i = 1; i < input.length; i++) {
    const item = input[i]!
    const key = evalSingleKey(evaluate, args, item, env, tracker, span, label)
    if (keep(compareValues(key, bestKey))) {
      bestKey = key
      bestItem = item
    }
  }
  return bestItem
}
