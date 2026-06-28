import type { FilterNode } from '../../ast'
import { RuntimeError } from '../../errors'
import type { LimitTracker } from '../../limits'
import type { Evaluator } from '../../types'
import type { Value } from '../../value'
import { emit } from '../common'
import type { EnvStack } from '../types'

const normalizeSliceStart = (value: number): number => Math.floor(value)

const normalizeSliceEnd = (value: number): number => Math.ceil(value)

/**
 * Resolves the bound expressions for a slice (start or end).
 *
 * When the bound node is absent, the provided default is used.
 */
function resolveSliceBounds(
  boundNode: FilterNode | null | undefined,
  defaultValue: number,
  label: string,
  node: Extract<FilterNode, { kind: 'Slice' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): number[] {
  const bounds: number[] = []
  if (boundNode) {
    for (const value of evaluate(boundNode, input, env, tracker)) {
      if (typeof value !== 'number')
        throw new RuntimeError(`Slice ${label} must be number`, node.span)
      bounds.push(value)
    }
  } else {
    bounds.push(defaultValue)
  }
  return bounds
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

    const starts = resolveSliceBounds(node.start, 0, 'start', node, input, env, tracker, evaluate)
    const ends = resolveSliceBounds(
      node.end,
      target.length,
      'end',
      node,
      input,
      env,
      tracker,
      evaluate
    )

    // Cartesian product of start/end
    for (const s of starts) {
      for (const e of ends) {
        yield emit(target.slice(normalizeSliceStart(s), normalizeSliceEnd(e)), node.span, tracker)
      }
    }
  }
}
