import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import { isValueArray, isPlainObject, describeType, type Value } from '../value'
import type { Evaluator } from '../builtins/types'
import { emit } from './common'
import type { EnvStack } from './types'
import { bindFrame } from './env'

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
    // Use a new frame for the binding to ensure correct scoping and avoid mutation issues
    const newEnv = bindFrame(node.pattern, item, env)

    const updates = Array.from(evaluate(node.update, acc, newEnv, tracker))
    if (updates.length !== 1) {
      throw new RuntimeError('Reduce update must produce single value', node.update.span)
    }
    acc = updates[0]!
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
    // Use a new frame for the binding to ensure correct scoping and avoid mutation issues
    const newEnv = bindFrame(node.pattern, item, env)

    const updates = Array.from(evaluate(node.update, acc, newEnv, tracker))
    if (updates.length !== 1) {
      throw new RuntimeError('Foreach update must produce single value', node.update.span)
    }
    acc = updates[0]!

    if (node.extract) {
      for (const extracted of evaluate(node.extract, acc, newEnv, tracker)) {
        yield emit(extracted, node.span, tracker)
      }
    } else {
      yield emit(acc, node.span, tracker)
    }
  }
}

/**
 * Evaluates the recursive descent operator `..`.
 *
 * `..` = emit self, then recurse over children.
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

  // Recurse through the shared evaluator so each level of input nesting goes
  // through tracker.step / enter / exit and honors maxSteps and maxDepth.
  for (const child of children) {
    yield* evaluate(node, child, env, tracker)
  }
}
