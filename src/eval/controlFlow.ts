import type { IfNode, TryNode, LabelNode } from '../ast'
import { BreakSignal } from './break'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import { isTruthy } from '../value'
import type { EnvStack, Evaluator } from './types'

/**
 * Evaluates an `if-then-else` expression.
 *
 * @param node - The If AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalIf = function* (
  node: IfNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  yield* evalIfBranch(node, 0, input, env, tracker, evaluate)
}

function* evalIfBranch(
  node: IfNode,
  branchIndex: number,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  if (branchIndex >= node.branches.length) {
    yield* evaluate(node.else, input, env, tracker)
    return
  }

  const branch = node.branches[branchIndex]!
  for (const cond of evaluate(branch.cond, input, env, tracker)) {
    if (isTruthy(cond)) {
      yield* evaluate(branch.then, input, env, tracker)
    } else {
      yield* evalIfBranch(node, branchIndex + 1, input, env, tracker, evaluate)
    }
  }
}

/**
 * Evaluates a `try-catch` expression.
 *
 * @param node - The Try AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalTry = function* (
  node: TryNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  try {
    yield* evaluate(node.body, input, env, tracker)
  } catch (err) {
    if (err instanceof RuntimeError) {
      if (node.handler) {
        // Feed error string to handler
        yield* evaluate(node.handler, err.message, env, tracker)
      } else {
        // Suppress
      }
    } else {
      throw err
    }
  }
}

/**
 * Evaluates a `label` expression, establishing a target for `break`.
 *
 * @param node - The Label AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalLabel = function* (
  node: LabelNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  try {
    yield* evaluate(node.body, input, env, tracker)
  } catch (e) {
    if (e instanceof BreakSignal) {
      if (e.label === node.label) return // Caught matching break
    }
    throw e
  }
}
