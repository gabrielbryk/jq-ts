import type { CallNode, DefNode } from '../ast'
import { RuntimeError } from '../errors'
import type { LimitTracker } from '../limits'
import type { Value } from '../value'
import { builtins } from '../builtins'
import type { EnvStack, EnvFrame, Evaluator, FunctionDef } from './types'

/**
 * Evaluates a function call.
 *
 * Checks for:
 * 1. User-defined functions in the current environment stack (local scope).
 * 2. Standard library built-ins.
 *
 * Handles closure creation for arguments and recursion.
 *
 * @param node - The call AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalCall = function* (
  node: CallNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  // 1. Check for user-defined function in scope
  for (let i = env.length - 1; i >= 0; i--) {
    const frame = env[i]!
    const funcs = frame.funcs.get(node.name)
    if (funcs) {
      const def = funcs.find((f) => f.args.length === node.args.length)
      if (def) {
        const newFrame: EnvFrame = { vars: new Map(), funcs: new Map() }

        for (let j = 0; j < node.args.length; j++) {
          const argName = def.args[j]!
          const argBody = node.args[j]!
          // Bind argName as a function of arity 0
          const argDefs = newFrame.funcs.get(argName) || []
          argDefs.push({
            args: [],
            body: argBody, // The AST of the argument filter
            closure: env, // Lexical scope at CALL SITE
          })
          newFrame.funcs.set(argName, argDefs)
        }

        // Closure stack + new frame
        // NOTE: `def.closure` is the env at definition time.
        const newStack = [...def.closure, newFrame]
        yield* evaluate(def.body, input, newStack, tracker)
        return
      }
    }
  }

  // 2. Builtins fallback
  const specs = builtins[node.name]
  if (!specs) {
    throw new RuntimeError(`Unknown function: ${node.name}`, node.span)
  }
  const builtin = specs.find((s) => s.arity === node.args.length)
  if (!builtin) {
    throw new RuntimeError(
      `Function ${node.name} does not accept ${node.args.length} arguments`,
      node.span
    )
  }
  yield* builtin.apply(input, node.args, env, tracker, evaluate, node.span)
}

/**
 * Defines a new function in the environment.
 *
 * Adds the function definition to the current scope and executes the `next` expression
 * with the updated environment.
 *
 * @param node - The function definition AST node.
 * @param input - The current input value.
 * @param env - The environment.
 * @param tracker - Limits tracker.
 * @param evaluate - Recursive evaluator.
 */
export const evalDef = function* (
  node: DefNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
): Generator<Value> {
  const newFrame: EnvFrame = { vars: new Map(), funcs: new Map() }
  const currentDefs = newFrame.funcs.get(node.name) || []

  const funDef: FunctionDef = {
    args: node.args,
    body: node.body,
    closure: [], // Will be patched
  }
  currentDefs.push(funDef)
  newFrame.funcs.set(node.name, currentDefs)

  const newStack = [...env, newFrame]
  funDef.closure = newStack // Recursion support

  yield* evaluate(node.next, input, newStack, tracker)
}
