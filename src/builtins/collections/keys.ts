import { RuntimeError } from '../../errors'
import type { BuiltinSpec } from '../types'
import { emit, ensureIndex } from '../utils'

export const keyBuiltins: BuiltinSpec[] = [
  {
    name: 'keys',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const indices = Array.from({ length: input.length }, (_, i) => i)
        yield emit(indices, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const sortedKeys = Object.keys(input).sort()
        yield emit(sortedKeys, span, tracker)
      } else {
        throw new RuntimeError(`keys expects an array or object`, span)
      }
    },
  },
  {
    name: 'has',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const keyFilter = args[0]!
      for (const key of evaluate(keyFilter, input, env, tracker)) {
        if (Array.isArray(input)) {
          const idx = ensureIndex(key)
          yield emit(idx !== undefined && idx >= 0 && idx < input.length, span, tracker)
        } else if (input !== null && typeof input === 'object') {
          let keyStr: string
          if (typeof key === 'string') keyStr = key
          else if (typeof key === 'number') keyStr = key.toString()
          else {
            throw new RuntimeError(`has() key must be string or number for object input`, span)
          }
          yield emit(Object.prototype.hasOwnProperty.call(input, keyStr), span, tracker)
        } else {
          throw new RuntimeError(`has() expects an array or object input`, span)
        }
      }
    },
  },
  {
    name: 'keys_unsorted',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const indices = Array.from({ length: input.length }, (_, i) => i)
        yield emit(indices, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input)
        yield emit(keys, span, tracker)
      } else {
        throw new RuntimeError(`keys_unsorted expects an array or object`, span)
      }
    },
  },
  {
    name: 'in',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      for (const container of evaluate(args[0]!, input, env, tracker)) {
        if (Array.isArray(container)) {
          if (typeof input !== 'number') {
            throw new RuntimeError(`Cannot check whether array has a ${typeof input} key`, span)
          }
          const idx = ensureIndex(input)
          yield emit(idx !== undefined && idx >= 0 && idx < container.length, span, tracker)
          continue
        }
        if (container !== null && typeof container === 'object') {
          if (typeof input !== 'string') {
            throw new RuntimeError(`Cannot check whether object has a ${typeof input} key`, span)
          }
          yield emit(Object.prototype.hasOwnProperty.call(container, input), span, tracker)
          continue
        }
        throw new RuntimeError('in expects an array or object argument', span)
      }
    },
  },
]
