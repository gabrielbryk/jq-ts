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
    name: 'skip',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const n of evaluate(args[0]!, input, env, tracker)) {
        if (typeof n !== 'number') throw new RuntimeError('skip expects number', span)
        let count = 0
        for (const val of evaluate(args[1]!, input, env, tracker)) {
          if (count >= n) yield val
          count++
        }
      }
    },
  },
  {
    name: 'first',
    arity: 0,
    apply: function* (input) {
      if (Array.isArray(input) && input.length > 0) yield input[0]!
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
    arity: 0,
    apply: function* (input) {
      if (Array.isArray(input) && input.length > 0) yield input[input.length - 1]!
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
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('nth expects array input', span)
      for (const n of evaluate(args[0]!, input, env, tracker)) {
        if (typeof n !== 'number') throw new RuntimeError('nth expects number', span)
        const idx = Math.trunc(n)
        if (idx >= 0 && idx < input.length) yield input[idx]!
      }
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
    arity: 0,
    apply: function* (input, _args, _env, tracker, _evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('all expects an array', span)
      yield emit(input.every(isTruthy), span, tracker)
    },
  },
  {
    name: 'all',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('all expects an array', span)
      let result = true
      for (const item of input) {
        let itemResult = false
        for (const val of evaluate(args[0]!, item, env, tracker)) {
          if (isTruthy(val)) {
            itemResult = true
            break
          }
        }
        if (!itemResult) {
          result = false
          break
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'all',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let result = true
      for (const item of evaluate(args[0]!, input, env, tracker)) {
        let itemResult = false
        for (const condition of evaluate(args[1]!, item, env, tracker)) {
          if (isTruthy(condition)) {
            itemResult = true
            break
          }
        }
        if (!itemResult) {
          result = false
          break
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'any',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('any expects an array', span)
      yield emit(input.some(isTruthy), span, tracker)
    },
  },
  {
    name: 'any',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('any expects an array', span)
      let result = false
      for (const item of input) {
        for (const val of evaluate(args[0]!, item, env, tracker)) {
          if (isTruthy(val)) {
            result = true
            break
          }
        }
        if (result) break
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'any',
    arity: 2,
    apply: function* (input, args, env, tracker, evaluate, span) {
      let result = false
      for (const item of evaluate(args[0]!, input, env, tracker)) {
        for (const condition of evaluate(args[1]!, item, env, tracker)) {
          if (isTruthy(condition)) {
            result = true
            break
          }
        }
        if (result) break
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'recurse',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _evaluate, span) {
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
