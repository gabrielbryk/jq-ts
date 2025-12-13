import type { FilterNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import { getPath } from '../builtins/paths'
import type { Evaluator } from '../builtins/types'
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
): Generator<(string | number)[]> {
  switch (node.kind) {
    case 'Identity':
      yield []
      return
    case 'FieldAccess':
      for (const parent of evaluatePath(node.target, input, env, tracker, evaluate)) {
        yield [...parent, node.field]
      }
      return
    case 'IndexAccess': {
      const parentPaths = Array.from(evaluatePath(node.target, input, env, tracker, evaluate))
      const output = evaluate(node.index, input, env, tracker)
      for (const keyVal of output) {
        let key: string | number
        if (typeof keyVal === 'string') key = keyVal
        else if (typeof keyVal === 'number' && Number.isInteger(keyVal)) key = keyVal
        else throw new RuntimeError('Path index must be string or integer', node.span)

        for (const parent of parentPaths) {
          yield [...parent, key]
        }
      }
      return
    }
    case 'Pipe': {
      // For .a | .b
      // 1. Get paths of left (.a)
      // 2. For each path p, get value v = getPath(input, p)
      // 3. Get paths of right (.b) against v -> q
      // 4. Yield [...p, ...q]

      const leftPaths = Array.from(evaluatePath(node.left, input, env, tracker, evaluate))
      for (const p of leftPaths) {
        const val = getPath(input, p) ?? null
        for (const q of evaluatePath(node.right, val, env, tracker, evaluate)) {
          yield [...p, ...q]
        }
      }
      return
    }
    case 'Comma':
      yield* evaluatePath(node.left, input, env, tracker, evaluate)
      yield* evaluatePath(node.right, input, env, tracker, evaluate)
      return
    case 'Iterate': {
      const parentPaths = Array.from(evaluatePath(node.target, input, env, tracker, evaluate))
      for (const p of parentPaths) {
        const val = getPath(input, p)
        if (Array.isArray(val)) {
          for (let i = 0; i < val.length; i++) {
            yield [...p, i]
          }
        } else if (val !== null && typeof val === 'object') {
          // Object
          for (const key of Object.keys(val)) {
            yield [...p, key]
          }
        } else {
          // Iterate on null is empty, others error?
          if (val === null) continue
          throw new RuntimeError(`Cannot iterate over ${typeof val}`, node.span)
        }
      }
      return
    }
    case 'Call':
      if (node.name === 'select') {
        const conds = evaluate(node.args[0]!, input, env, tracker)
        let matched = false
        for (const c of conds) {
          if (c !== null && c !== false) {
            matched = true // Truthy
          }
        }
        if (matched) yield [] // Relative path is empty (identity)
        return
      }
      throw new RuntimeError(`Function ${node.name} not supported in path expression`, node.span)
    default:
      throw new RuntimeError('Invalid path expression', node.span)
  }
}
