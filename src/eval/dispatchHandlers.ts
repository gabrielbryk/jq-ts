import type { AltNode, AsNode, CommaNode, PipeNode, VarNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Evaluator } from '../types'
import type { Value } from '../value'
import { emit } from './common'
import { bindFrame, getVar } from './env'
import type { EnvStack } from './types'

/**
 * Resolves a `$variable` reference from the environment.
 */
export function* evalVar(
  node: VarNode,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value, void, undefined> {
  const val = getVar(env, node.name)
  if (val === undefined) {
    throw new RuntimeError(`Undefined variable: ${node.name}`, node.span)
  }
  yield emit(val, node.span, tracker)
}

/**
 * Pipe operator: feeds each output of the left filter into the right filter.
 */
export function* evalPipe(
  node: PipeNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  for (const leftVal of evaluate(node.left, input, env, tracker)) {
    yield* evaluate(node.right, leftVal, env, tracker)
  }
}

/**
 * Comma operator: concatenates the streams of the left and right filters.
 */
export function* evalComma(
  node: CommaNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  yield* evaluate(node.left, input, env, tracker)
  yield* evaluate(node.right, input, env, tracker)
}

/**
 * Alternative operator `//`: falls back to the right filter when the left
 * yields no values that are neither `null` nor `false`.
 */
export function* evalAlt(
  node: AltNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  const leftValues = Array.from<Value>(evaluate(node.left, input, env, tracker))
  const valid = leftValues.filter((v) => v !== null && v !== false)
  if (valid.length > 0) {
    for (const v of valid) {
      yield v
    }
  } else {
    yield* evaluate(node.right, input, env, tracker)
  }
}

/**
 * `expression as $pattern | body` binding expression.
 */
export function* evalAs(
  node: AsNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value, void, undefined> {
  const values = Array.from(evaluate(node.bind, input, env, tracker))
  for (const val of values) {
    // Use a new frame for the binding to ensure correct scoping and avoid mutation issues
    const newEnv = bindFrame(node.pattern, val, env)
    yield* evaluate(node.body, input, newEnv, tracker)
  }
}
