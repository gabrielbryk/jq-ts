import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Evaluator } from '../../types'
import { describeType, isPlainObject, isValueArray, type Value } from '../../value'
import { emit, toIndex } from '../common'
import type { EnvStack } from '../types'

/**
 * Yields the element at the given index values within an array container.
 * Supports negative indices and emits `null` for out-of-range indices.
 */
function* indexArray(
  container: readonly Value[],
  indexValues: readonly Value[],
  node: Extract<FilterNode, { kind: 'IndexAccess' }>,
  tracker: LimitTracker
): Generator<Value> {
  for (const idxValue of indexValues) {
    const index = toIndex(idxValue, node.span)
    if (index === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    const resolved = index < 0 ? container.length + index : index
    if (resolved < 0 || resolved >= container.length) {
      yield emit(null, node.span, tracker)
    } else {
      yield emit(container[resolved]!, node.span, tracker)
    }
  }
}

/**
 * Yields the value at the given key values within an object container.
 */
function* indexObject(
  container: Record<string, Value>,
  indexValues: readonly Value[],
  node: Extract<FilterNode, { kind: 'IndexAccess' }>,
  tracker: LimitTracker
): Generator<Value> {
  for (const keyValue of indexValues) {
    if (typeof keyValue !== 'string') {
      throw new RuntimeError(`Cannot index object with ${describeType(keyValue)}`, node.span)
    }
    yield emit(
      Object.prototype.hasOwnProperty.call(container, keyValue) ? container[keyValue]! : null,
      node.span,
      tracker
    )
  }
}

/**
 * Evaluates index access (`.[0]`, `.["foo"]`).
 * Supports negative indices for arrays.
 *
 * @param node - The index access AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalIndex = function* (
  node: Extract<FilterNode, { kind: 'IndexAccess' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const indexValues = Array.from<Value>(evaluate(node.index, input, env, tracker))
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    if (isValueArray(container)) {
      yield* indexArray(container, indexValues, node, tracker)
      continue
    }
    if (isPlainObject(container)) {
      yield* indexObject(container, indexValues, node, tracker)
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)}`, node.span)
  }
}
