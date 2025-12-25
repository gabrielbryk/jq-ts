import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import { type Value, compareValues } from '../value'
import { getPath, updatePath, deletePaths, type PathSegment } from '../builtins/paths'
import { applyBinaryOp } from './ops'
import type { Evaluator } from '../builtins/types'
import { emit } from './common'
import { evaluatePath } from './path_eval'
import type { EnvStack } from './types'

/**
 * Evaluates assignment and update operators (`=`, `|=`, `+=`, etc.).
 *
 * Implements the complex path update logic of jq.
 * It first resolves the path(s) on the left-hand side, then computes new values,
 * and finally reconstructs the object with the updated values.
 *
 * @param node - The assignment AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalAssignment = function* (
  node: Extract<FilterNode, { kind: 'Assignment' }>,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const paths = Array.from(evaluatePath(node.left, input, env, tracker, evaluate))
  // Sort paths descending to handle array deletion correctly (higher indices first)
  paths.sort((a, b) => compareValues(a, b) * -1)

  if (paths.length === 0) {
    yield emit(input, node.span, tracker)
    return
  }

  // Case 1: Plain Assignment '='
  if (node.op === '=') {
    const rhsValues = Array.from(evaluate(node.right, input, env, tracker))
    if (rhsValues.length === 0) return

    for (const rhsVal of rhsValues) {
      let current = input
      for (const path of paths) {
        current = updatePath(current, path, () => rhsVal, node.span) ?? current
      }
      yield emit(current, node.span, tracker)
    }
    return
  }

  // Case 2: Update Assignment '|=', '+=', etc.
  yield* applyUpdates(input, paths, 0, node.op, node.right, input, env, tracker, evaluate)
}

function* applyUpdates(
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

  // Determine new values for this path
  let newValues: Value[] = []

  if (op === '|=') {
    newValues = Array.from(evaluate(rhsNode, oldValue, env, tracker))
  } else {
    // Sugar ops: +=, -=, *=, /=, %=, //=
    const rhsResults = Array.from(evaluate(rhsNode, contextInput, env, tracker))
    for (const rhs of rhsResults) {
      let res: Value
      switch (op) {
        case '+=':
          res = applyBinaryOp('+', oldValue, rhs, rhsNode.span)
          break
        case '-=':
          res = applyBinaryOp('-', oldValue, rhs, rhsNode.span)
          break
        case '*=':
          res = applyBinaryOp('*', oldValue, rhs, rhsNode.span)
          break
        case '/=':
          res = applyBinaryOp('/', oldValue, rhs, rhsNode.span)
          break
        case '%=':
          res = applyBinaryOp('%', oldValue, rhs, rhsNode.span)
          break
        case '//=':
          // false is falsey in jq, so //= should replace if left is false or null.
          res = oldValue !== null && oldValue !== false ? oldValue : rhs
          break
        default:
          throw new RuntimeError(`Unknown assignment op: ${op}`, rhsNode.span)
      }
      newValues.push(res)
    }
  }

  if (newValues.length === 0) {
    // If the RHS outputs no values, the path is deleted.
    // deletePaths expects an array of paths. Here we delete just one path 'path'.
    const nextObject = deletePaths(current, [path], rhsNode.span)
    // Recurse for the next path in 'paths'
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
    return
  }

  for (const val of newValues) {
    const nextObject = updatePath(current, path, () => val, rhsNode.span) ?? current
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
