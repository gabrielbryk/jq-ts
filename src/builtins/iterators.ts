import { RuntimeError } from '../errors'
import { isTruthy, type Value } from '../value'
import type { BuiltinSpec } from './types'
import { emit } from './utils'

export const iteratorBuiltins: BuiltinSpec[] = [
  // --- Generators ---
  {
    name: 'range',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(end): 0 to end
      const ends = evaluate(args[0]!, input, env, tracker)
      for (const end of ends) {
        if (typeof end !== 'number') throw new RuntimeError('range expects numbers', span)
        for (let i = 0; i < end; i++) {
          yield emit(i, span, tracker)
        }
      }
    },
  },
  {
    name: 'range',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(start; end): start to end (step 1)
      const starts = Array.from(evaluate(args[0]!, input, env, tracker))
      const ends = Array.from(evaluate(args[1]!, input, env, tracker))
      for (const start of starts) {
        for (const end of ends) {
          if (typeof start !== 'number' || typeof end !== 'number')
            throw new RuntimeError('range expects numbers', span)
          if (start < end) {
            for (let i = start; i < end; i++) {
              yield emit(i, span, tracker)
            }
          } else {
            // jq behavior: if start > end, range is empty (step defaults to 1)
          }
        }
      }
    },
  },
  {
    name: 'range',
    arity: 3,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // range(start; end; step)
      const starts = Array.from(evaluate(args[0]!, input, env, tracker))
      const ends = Array.from(evaluate(args[1]!, input, env, tracker))
      const steps = Array.from(evaluate(args[2]!, input, env, tracker))

      for (const start of starts) {
        for (const end of ends) {
          for (const step of steps) {
            if (typeof start !== 'number' || typeof end !== 'number' || typeof step !== 'number') {
              throw new RuntimeError('range expects numbers', span)
            }
            if (step === 0) throw new RuntimeError('range step cannot be zero', span)

            if (step > 0) {
              for (let i = start; i < end; i += step) {
                yield emit(i, span, tracker)
              }
            } else {
              for (let i = start; i > end; i += step) {
                yield emit(i, span, tracker)
              }
            }
          }
        }
      }
    },
  },

  // --- Iterators ---
  {
    name: 'limit',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // limit(n; expr)
      const limits = evaluate(args[0]!, input, env, tracker)
      for (const n of limits) {
        if (typeof n !== 'number') throw new RuntimeError('limit expects number', span)
        let count = 0
        if (n > 0) {
          for (const val of evaluate(args[1]!, input, env, tracker)) {
            yield val // val is already emitted by expr
            count++
            if (count >= n) break
          }
        }
      }
    },
  },
  {
    name: 'first',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate) {
      // first(expr) -> limit(1; expr)
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        yield val
        break
      }
    },
  },
  {
    name: 'last',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate) {
      // last(expr)
      let lastVal: Value | undefined
      let found = false
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        lastVal = val
        found = true
      }
      if (found) yield lastVal as Value
    },
  },
  {
    name: 'nth',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // nth(n; expr)
      const indices = evaluate(args[0]!, input, env, tracker)
      for (const n of indices) {
        if (typeof n !== 'number') throw new RuntimeError('nth expects number', span)
        let count = 0
        for (const val of evaluate(args[1]!, input, env, tracker)) {
          if (count === n) {
            yield val
            break // optimization: stop after finding nth? jq nth stops.
          }
          count++
        }
      }
    },
  },
  {
    name: 'isempty',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // isempty(expr) -> true if empty, false otherwise
      let empty = true
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of evaluate(args[0]!, input, env, tracker)) {
        empty = false
        break
      }
      yield emit(empty, span, tracker)
    },
  },

  // --- Aggregators ---
  {
    name: 'all',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // all(expr): checks if all outputs of expr are truthy
      let result = true
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        if (!isTruthy(val)) {
          result = false
          break // short-circuit
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'any',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // any(expr): checks if any output of expr is truthy
      let result = false
      for (const val of evaluate(args[0]!, input, env, tracker)) {
        if (isTruthy(val)) {
          result = true
          break // short-circuit
        }
      }
      yield emit(result, span, tracker)
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
]
