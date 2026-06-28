import { isTruthy, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const recurseBuiltins: BuiltinSpec[] = [
  {
    name: 'recurse',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      const rec = function* (curr: Value): Generator<Value> {
        yield emit(curr, span, tracker)
        if (Array.isArray(curr)) {
          for (const item of curr) yield* rec(item)
        } else if (curr !== null && typeof curr === 'object') {
          const keys = Object.keys(curr).sort()
          for (const key of keys) yield* rec(curr[key]!)
        }
      }
      yield* rec(input)
    },
  },
  {
    name: 'recurse',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // recurse(f): emit ., then f | recurse(f) (depth-first)
      const rec = function* (curr: Value): Generator<Value> {
        yield emit(curr, span, tracker)
        const nexts = evaluate(args[0]!, curr, env, tracker)
        for (const next of nexts) {
          yield* rec(next)
        }
      }
      yield* rec(input)
    },
  },
  {
    name: 'recurse',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const stepExpr = args[0]!
      const conditionExpr = args[1]!
      const rec = function* (curr: Value): Generator<Value> {
        yield emit(curr, span, tracker)
        for (const condition of evaluate(conditionExpr, curr, env, tracker)) {
          if (!isTruthy(condition)) return
          break
        }
        for (const next of evaluate(stepExpr, curr, env, tracker)) {
          yield* rec(next)
        }
      }
      yield* rec(input)
    },
  },
]
