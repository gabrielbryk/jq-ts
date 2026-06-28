import type { FilterNode } from '../ast'
import { resolveClock } from '../clock'
import { RuntimeError } from '../errors'
import { LimitTracker, resolveLimits } from '../limits'
import type { Value } from '../value'
import { handlers } from './dispatchTable'
import type { EnvStack, EvalOptions } from './types'

/**
 * Runs a jq AST against an input value.
 *
 * @param ast - The parsed AST.
 * @param input - The initial input value (JSON).
 * @param options - Execution options.
 * @returns An array of all values yielded by the filter.
 */
export const runAst = (ast: FilterNode, input: Value, options: EvalOptions = {}): Value[] => {
  const tracker = new LimitTracker(resolveLimits(options.limits), resolveClock(options.now))
  const globalVars = new Map<string, Value>(Object.entries(options.vars ?? {}))
  const env: EnvStack = [{ vars: globalVars, funcs: new Map() }]
  return Array.from<Value>(evaluate(ast, input, env, tracker))
}

/**
 * The core evaluation generator.
 *
 * Dispatches execution to the handler registered for the AST node's kind in the
 * {@link handlers} table. It uses a generator to support jq's streaming nature
 * (backtracking and multiple outputs).
 *
 * @param node - The current AST node to evaluate.
 * @param input - The current input value (context).
 * @param env - The current environment (variables and functions).
 * @param tracker - The limit tracker for safety.
 * @yields The output values produced by the filter.
 */
function* evaluate(
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
): Generator<Value, void, undefined> {
  if (!node) {
    throw new RuntimeError('evaluate called with undefined node', { start: 0, end: 0 })
  }
  tracker.step(node.span)
  tracker.enter(node.span)
  try {
    yield* handlers[node.kind](node, input, env, tracker, evaluate)
  } finally {
    tracker.exit()
  }
}
