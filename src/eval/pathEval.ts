import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import { type PathSegment } from '../path'
import type { Evaluator } from '../types'
import type { Value } from '../value'
import { call, comma, pipe, tryPath } from './pathEval/combinators'
import type { PathContext } from './pathEval/internal'
import { fieldAccess, indexAccess, iterate, slice } from './pathEval/segments'
import type { EnvStack } from './types'

/**
 * Resolves properties paths for assignment or `path()` built-in.
 * Returns an array of paths (arrays of strings/numbers) for valid locations.
 *
 * @param node - The AST node describing trailing field access/indexing.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evaluatePath = function* (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<PathSegment[]> {
  const ctx: PathContext = { input, env, tracker, evaluate, recurse: evaluatePath }
  switch (node.kind) {
    case 'Identity':
      yield []
      return
    case 'FieldAccess':
      yield* fieldAccess(node, ctx)
      return
    case 'IndexAccess':
      yield* indexAccess(node, ctx)
      return
    case 'Pipe':
      yield* pipe(node, ctx)
      return
    case 'Comma':
      yield* comma(node, ctx)
      return
    case 'Iterate':
      yield* iterate(node, ctx)
      return
    case 'Call':
      yield* call(node, ctx)
      return
    case 'Slice':
      yield* slice(node, ctx)
      return
    case 'Try':
      yield* tryPath(node, ctx)
      return
    case 'Var':
      // Rooting a path in a variable is valid if the path is evaluated against the variable's value.
      // In assignment, ($x | .a) = 1 means update $x at .a.
      // So yielding [] (identity) for Var is correct when it's the target of a pipe or similar.
      yield []
      return
    default:
      throw new RuntimeError('Invalid path expression', node.span)
  }
}
