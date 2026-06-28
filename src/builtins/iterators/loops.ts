import { isTruthy, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const loopBuiltins: BuiltinSpec[] = [
  {
    name: 'while',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const condExpr = args[0]!
      const updateExpr = args[1]!
      const rec = function* (curr: Value): Generator<Value> {
        tracker.step(span) // Step for recursion/loop
        let condMatches = false
        for (const c of evaluate(condExpr, curr, env, tracker)) {
          if (isTruthy(c)) {
            condMatches = true
            break
          }
        }

        if (condMatches) {
          yield emit(curr, span, tracker)
          for (const next of evaluate(updateExpr, curr, env, tracker)) {
            yield* rec(next)
          }
        }
      }
      yield* rec(input)
    },
  },
  {
    name: 'until',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const condExpr = args[0]!
      const updateExpr = args[1]!
      const rec = function* (curr: Value): Generator<Value> {
        tracker.step(span)
        let condMatches = false
        for (const c of evaluate(condExpr, curr, env, tracker)) {
          if (isTruthy(c)) {
            condMatches = true
            break
          }
        }

        if (condMatches) {
          yield emit(curr, span, tracker)
        } else {
          for (const next of evaluate(updateExpr, curr, env, tracker)) {
            yield* rec(next)
          }
        }
      }
      yield* rec(input)
    },
  },
  {
    name: 'repeat',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // repeat(exp): repeatedly yield outputs of exp
      while (true) {
        tracker.step(span)
        yield* evaluate(args[0]!, input, env, tracker)
      }
    },
  },
]
