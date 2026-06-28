import type { FilterNode } from '../../ast'
import type { LimitTracker } from '../../limits'
import type { PathSegment } from '../../path'
import type { Evaluator } from '../../types'
import type { Value } from '../../value'
import type { EnvStack } from '../types'

/**
 * Signature of the recursive path evaluator. Handlers receive this so they can
 * resolve the paths of nested sub-nodes without importing `evaluatePath`
 * directly (which would create a load-time circular dependency).
 */
export type PathRecurse = (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
) => Generator<PathSegment[]>

/** Context shared by every path-segment handler. */
export interface PathContext {
  input: Value
  env: EnvStack
  tracker: LimitTracker
  evaluate: Evaluator
  recurse: PathRecurse
}
