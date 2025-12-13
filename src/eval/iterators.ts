import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import { isValueArray, isPlainObject, describeType, type Value } from '../value'
import type { Evaluator } from '../builtins/types'
import { emit } from './common'
import { pushBinding, popBinding } from './env'
import type { EnvStack } from './types'

/**
 * Iterates over the values of an array or object (`.[]`).
 *
 * @param node - The iterate AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalIterate = function* (
  node: Extract<FilterNode, { kind: 'Iterate' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      continue
    }
    if (isValueArray(container)) {
      for (const item of container) {
        yield emit(item, node.span, tracker)
      }
      continue
    }
    if (isPlainObject(container)) {
      const keys = Object.keys(container).sort()
      for (const key of keys) {
        yield emit(container[key]!, node.span, tracker)
      }
      continue
    }
    throw new RuntimeError(`Cannot iterate over ${describeType(container)}`, node.span)
  }
}

/**
 * Executes a `reduce` operation.
 *
 * `reduce inputs as $var (init; update)`
 *
 * @param node - The reduce AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalReduce = function* (
  node: Extract<FilterNode, { kind: 'Reduce' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const initValues = Array.from(evaluate(node.init, input, env, tracker))
  if (initValues.length !== 1) {
    throw new RuntimeError('Reduce init must single value', node.init.span)
  }
  let acc = initValues[0]!

  for (const item of evaluate(node.source, input, env, tracker)) {
    tracker.step(node.span)
    pushBinding(env, node.var, item)
    try {
      const updates = Array.from(evaluate(node.update, acc, env, tracker))
      if (updates.length !== 1) {
        throw new RuntimeError('Reduce update must produce single value', node.update.span)
      }
      acc = updates[0]!
    } finally {
      popBinding(env, node.var)
    }
  }
  yield emit(acc, node.span, tracker)
}

/**
 * Executes a `foreach` operation.
 *
 * `foreach inputs as $var (init; update; extract)`
 *
 * @param node - The foreach AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalForeach = function* (
  node: Extract<FilterNode, { kind: 'Foreach' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const initValues = Array.from(evaluate(node.init, input, env, tracker))
  if (initValues.length !== 1) {
    throw new RuntimeError('Foreach init must single value', node.init.span)
  }
  let acc = initValues[0]!

  for (const item of evaluate(node.source, input, env, tracker)) {
    tracker.step(node.span)
    pushBinding(env, node.var, item)
    try {
      const updates = Array.from(evaluate(node.update, acc, env, tracker))
      if (updates.length !== 1) {
        throw new RuntimeError('Foreach update must produce single value', node.update.span)
      }
      acc = updates[0]!

      if (node.extract) {
        for (const extracted of evaluate(node.extract, acc, env, tracker)) {
          yield emit(extracted, node.span, tracker)
        }
      } else {
        yield emit(acc, node.span, tracker)
      }
    } finally {
      popBinding(env, node.var)
    }
  }
}

/**
 * Evaluates the recursive operator `..`.
 * Deprecated node type kept for compatibility; currently implements `..` logic.
 *
 * @param node - The recurse AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalRecurse = function* (
  node: Extract<FilterNode, { kind: 'Recurse' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  // recurse: output input, then recurse on output of filter(input)
  // But wait, `recurse` (arity 0) is equivalent to `recurse(.[]?)`.
  // If `recurse(f)`: output input, then `f | recurse(f)`.
  // The AST node `Recurse` handles `..` (recurse input). `..` means `recurse`.
  // The builtin `recurse` handles arguments.
  // The AST node `Recurse` is likely for `..` operator which is equivalent to `recurse`.

  // Implementation of `..`:
  // Yield input.
  // Then recurse on children.
  // `recurse` builtin logic:
  // yield input.
  // for x in f(input): yield* recurse(x)

  // For `..`, f is `.[]?`.
  // Let's implement `..` specifically.

  yield emit(input, node.span, tracker)

  const children: Value[] = []
  if (isValueArray(input)) {
    children.push(...input)
  } else if (isPlainObject(input)) {
    const keys = Object.keys(input).sort() // jq iterates objects in sorted key order
    for (const key of keys) {
      children.push(input[key]!)
    }
  }

  for (const child of children) {
    yield* evalRecurse(node, child, env, tracker, evaluate)
  }
}
