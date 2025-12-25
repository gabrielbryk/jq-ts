import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import { isValueArray, isPlainObject, describeType, type Value } from '../value'
import type { Evaluator } from '../builtins/types'
import { emit, toIndex } from './common'
import type { EnvStack } from './types'

/**
 * Evaluates field access (`.foo`).
 *
 * @param node - The field access AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalField = function* (
  node: Extract<FilterNode, { kind: 'FieldAccess' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  for (const container of evaluate(node.target, input, env, tracker)) {
    if (container === null) {
      yield emit(null, node.span, tracker)
      continue
    }
    if (isPlainObject(container)) {
      yield emit(
        Object.prototype.hasOwnProperty.call(container, node.field) ? container[node.field]! : null,
        node.span,
        tracker
      )
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)} with string`, node.span)
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
      continue
    }
    if (isPlainObject(container)) {
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
      continue
    }
    throw new RuntimeError(`Cannot index ${describeType(container)}`, node.span)
  }
}

/**
 * Evaluates array slicing (`.[start:end]`).
 * Supports optional start/end (defaults to 0/length) and negative indices (via JS slice).
 *
 * @param node - The slice AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalSlice = function* (
  node: Extract<FilterNode, { kind: 'Slice' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  // Evaluate target
  for (const target of evaluate(node.target, input, env, tracker)) {
    if (typeof target !== 'string' && !Array.isArray(target)) {
      throw new RuntimeError('Slice expected string or array', node.span)
    }

    // Resolve start(s)
    const starts: number[] = []
    if (node.start) {
      for (const s of evaluate(node.start, input, env, tracker)) {
        if (typeof s !== 'number') throw new RuntimeError('Slice start must be number', node.span)
        starts.push(s)
      }
    } else {
      starts.push(0) // Default start
    }

    // Resolve end(s)
    const ends: number[] = []
    if (node.end) {
      for (const e of evaluate(node.end, input, env, tracker)) {
        if (typeof e !== 'number') throw new RuntimeError('Slice end must be number', node.span)
        ends.push(e)
      }
    } else {
      ends.push(target.length) // Default end
    }

    // Cartesian product of start/end
    for (const s of starts) {
      for (const e of ends) {
        yield emit(target.slice(s, e), node.span, tracker)
      }
    }
  }
}
