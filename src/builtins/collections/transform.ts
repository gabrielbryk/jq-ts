import { RuntimeError } from '../../errors'
import { isTruthy, type Value, type ValueObject } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

export const transformBuiltins: BuiltinSpec[] = [
  {
    name: 'map',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('map expects an array', span)
      const result: Value[] = []
      const filter = args[0]!
      for (const item of input) {
        tracker.step(span)
        for (const output of evaluate(filter, item, env, tracker)) {
          result.push(output)
        }
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'map_values',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const filter = args[0]!
      if (Array.isArray(input)) {
        const result: Value[] = []
        for (const item of input) {
          tracker.step(span)
          for (const output of evaluate(filter, item, env, tracker)) {
            result.push(output)
          }
        }
        yield emit(result, span, tracker)
        return
      }
      if (input !== null && typeof input === 'object') {
        const result: ValueObject = {}
        for (const key of Object.keys(input)) {
          tracker.step(span)
          let last: Value | undefined
          let found = false
          for (const output of evaluate(filter, input[key]!, env, tracker)) {
            last = output
            found = true
          }
          if (found) result[key] = last!
        }
        yield emit(result, span, tracker)
        return
      }
      throw new RuntimeError('map_values expects an array or object', span)
    },
  },
  {
    name: 'select',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const filter = args[0]!
      for (const res of evaluate(filter, input, env, tracker)) {
        if (isTruthy(res)) {
          yield emit(input, span, tracker)
          return
        }
      }
    },
  },
]
