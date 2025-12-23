import type { FilterNode } from '../ast'
import { BreakSignal } from './break'
import { RuntimeError } from '../errors'
import { LimitTracker, resolveLimits, type LimitsConfig } from '../limits'
import { isTruthy, type Value } from '../value'
import { applyBinaryOp, applyUnaryNeg } from './ops'

import { getVar } from './env'
import { emit } from './common'
import type { EnvStack, EnvFrame } from './types'

// Sub-modules
import { evalAssignment } from './assignment'
import { evalIterate, evalReduce, evalForeach, evalRecurse } from './iterators'
import { evalField, evalIndex, evalSlice } from './access'
import { buildArray, buildObjects } from './constructors'
import { evalCall, evalDef } from './functions'
import { evalIf, evalTry, evalLabel } from './control_flow'

/**
 * Configuration options for the evaluation engine.
 */
export interface EvalOptions {
  /**
   * Limit configuration to prevent infinite loops or excessive resource usage.
   */
  limits?: LimitsConfig
  /**
   * Predefined variables to seed the global environment.
   * Keys are variable names without the '$' prefix.
   */
  vars?: Record<string, Value>
}

/**
 * Runs a jq AST against an input value.
 *
 * @param ast - The parsed AST.
 * @param input - The initial input value (JSON).
 * @param options - Execution options.
 * @returns An array of all values yielded by the filter.
 */
export const runAst = (ast: FilterNode, input: Value, options: EvalOptions = {}): Value[] => {
  const tracker = new LimitTracker(resolveLimits(options.limits))
  const globalVars = new Map<string, Value>(Object.entries(options.vars ?? {}))
  const env: EnvStack = [{ vars: globalVars, funcs: new Map() }]
  return Array.from<Value>(evaluate(ast, input, env, tracker))
}

/**
 * The core evaluation generator.
 *
 * This function dispatches execution to specific handlers based on the AST node kind.
 * It uses a generator to support jq's streaming nature (backtracking and multiple outputs).
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
    throw new Error('evaluate called with undefined node')
  }
  tracker.step(node.span)
  tracker.enter(node.span)
  try {
    switch (node.kind) {
      case 'Identity':
        yield emit(input, node.span, tracker)
        return
      case 'Literal':
        yield emit(node.value, node.span, tracker)
        return
      case 'Var': {
        const val = getVar(env, node.name)
        if (val === undefined) {
          throw new RuntimeError(`Undefined variable: ${node.name}`, node.span)
        }
        yield emit(val, node.span, tracker)
        return
      }
      case 'FieldAccess':
        yield* evalField(node, input, env, tracker, evaluate)
        return
      case 'IndexAccess':
        yield* evalIndex(node, input, env, tracker, evaluate)
        return
      case 'Slice':
        yield* evalSlice(node, input, env, tracker, evaluate)
        return
      case 'Array':
        yield* buildArray(node, input, env, tracker, evaluate)
        return
      case 'Object':
        yield* buildObjects(node, input, env, tracker, evaluate)
        return
      case 'Label':
        yield* evalLabel(node, input, env, tracker, evaluate)
        return
      case 'Break':
        throw new BreakSignal(node.label)
      case 'Pipe':
        for (const leftVal of evaluate(node.left, input, env, tracker)) {
          yield* evaluate(node.right, leftVal, env, tracker)
        }
        return
      case 'Comma':
        yield* evaluate(node.left, input, env, tracker)
        yield* evaluate(node.right, input, env, tracker)
        return
      case 'Alt': {
        const leftValues = Array.from<Value>(evaluate(node.left, input, env, tracker))
        const valid = leftValues.filter((v) => v !== null && v !== false)
        if (valid.length > 0) {
          for (const v of valid) {
            yield v
          }
        } else {
          yield* evaluate(node.right, input, env, tracker)
        }
        return
      }
      case 'Unary':
        if (node.op === 'Not') {
          for (const value of evaluate(node.expr, input, env, tracker)) {
            yield emit(!isTruthy(value), node.span, tracker)
          }
        } else {
          for (const value of evaluate(node.expr, input, env, tracker)) {
            yield emit(applyUnaryNeg(value, node.span), node.span, tracker)
          }
        }
        return
      case 'Bool': {
        // Short-circuiting logic
        for (const l of evaluate(node.left, input, env, tracker)) {
          if (node.op === 'And') {
            if (!isTruthy(l)) {
              yield emit(false, node.span, tracker)
            } else {
              for (const r of evaluate(node.right, input, env, tracker)) {
                yield emit(isTruthy(l) && isTruthy(r), node.span, tracker)
              }
            }
          } else {
            // Or
            if (isTruthy(l)) {
              yield emit(true, node.span, tracker)
            } else {
              for (const r of evaluate(node.right, input, env, tracker)) {
                yield emit(isTruthy(l) || isTruthy(r), node.span, tracker)
              }
            }
          }
        }
        return
      }
      case 'Binary': {
        const leftRes = Array.from(evaluate(node.left, input, env, tracker))
        const rightRes = Array.from(evaluate(node.right, input, env, tracker))
        for (const l of leftRes) {
          for (const r of rightRes) {
            yield emit(applyBinaryOp(node.op, l, r, node.span), node.span, tracker)
          }
        }
        return
      }
      case 'If':
        yield* evalIf(node, input, env, tracker, evaluate)
        return
      case 'Try':
        yield* evalTry(node, input, env, tracker, evaluate)
        return
      case 'Recurse':
        yield* evalRecurse(node, input, env, tracker, evaluate)
        return
      case 'Iterate':
        yield* evalIterate(node, input, env, tracker, evaluate)
        return
      case 'Assignment':
        yield* evalAssignment(node, input, env, tracker, evaluate)
        return
      case 'Reduce':
        yield* evalReduce(node, input, env, tracker, evaluate)
        return
      case 'Foreach':
        yield* evalForeach(node, input, env, tracker, evaluate)
        return
      case 'As': {
        const values = Array.from(evaluate(node.bind, input, env, tracker))
        for (const val of values) {
          // Use a new frame for the binding to ensure correct scoping and avoid mutation issues
          const newFrame: EnvFrame = { vars: new Map([[node.name, val]]), funcs: new Map() }
          const newEnv = [...env, newFrame]
          yield* evaluate(node.body, input, newEnv, tracker)
        }
        return
      }
      case 'Call':
        yield* evalCall(node, input, env, tracker, evaluate)
        return
      case 'Def':
        yield* evalDef(node, input, env, tracker, evaluate)
        return
    }
  } finally {
    tracker.exit()
  }
}
