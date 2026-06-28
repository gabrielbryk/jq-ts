import type { FilterNode } from '../../ast'
import type { LimitTracker } from '../../limits'
import { deletePaths, getPath, type PathSegment, updatePath } from '../../path'
import type { Evaluator } from '../../types'
import type { Value } from '../../value'
import type { EnvStack } from '../types'
import { computeNewValues } from './sugarOps'

/**
 * Produces the next document state(s) after applying an update at a single path.
 *
 * When the RHS yields no values the path is deleted (one result); otherwise each
 * produced value yields a separate updated document (jq's cartesian semantics).
 */
function nextStatesForPath(
  current: Value,
  path: PathSegment[],
  newValues: Value[],
  span: FilterNode['span']
): Value[] {
  if (newValues.length === 0) {
    // If the RHS outputs no values, the path is deleted.
    // deletePaths expects an array of paths; here we delete just this one.
    return [deletePaths(current, [path], span)]
  }
  return newValues.map((val) => updatePath(current, path, () => val, span) ?? current)
}

/**
 * Recursively applies an update op (`|=`, `+=`, etc.) across a sorted list of
 * paths, threading the partially-updated value through each path in turn.
 */
export function* applyUpdates(
  current: Value,
  paths: PathSegment[][],
  index: number,
  op: string,
  rhsNode: FilterNode,
  contextInput: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  if (index >= paths.length) {
    yield current
    return
  }

  const path = paths[index]!
  const oldValue = getPath(current, path) ?? null
  const newValues = computeNewValues(op, oldValue, rhsNode, contextInput, env, tracker, evaluate)

  for (const nextObject of nextStatesForPath(current, path, newValues, rhsNode.span)) {
    yield* applyUpdates(
      nextObject,
      paths,
      index + 1,
      op,
      rhsNode,
      contextInput,
      env,
      tracker,
      evaluate
    )
  }
}
