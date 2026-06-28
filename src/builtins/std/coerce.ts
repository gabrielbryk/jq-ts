import { RuntimeError } from '../../errors'
import { describeType, isTruthy, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit, stableStringify } from '../utils'

const toJqString = (value: Value): string => {
  if (typeof value === 'string') return value
  return stableStringify(value)
}

export const coerceBuiltins: BuiltinSpec[] = [
  {
    name: 'type',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(describeType(input), span, tracker)
    },
  },
  {
    name: 'tostring',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(toJqString(input), span, tracker)
    },
  },
  {
    name: 'tonumber',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'number') {
        yield emit(input, span, tracker)
        return
      }
      if (typeof input === 'string') {
        const num = Number(input)
        if (!Number.isFinite(num)) {
          throw new RuntimeError(`Cannot convert string "${input}" to number`, span)
        }
        yield emit(num, span, tracker)
        return
      }
      throw new RuntimeError(`Cannot convert ${describeType(input)} to number`, span)
    },
  },
  {
    name: 'length',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'string') {
        // Use Array.from to count codepoints correctly
        yield emit(Array.from(input).length, span, tracker)
      } else if (Array.isArray(input)) {
        yield emit(input.length, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        // Object: number of keys
        yield emit(Object.keys(input).length, span, tracker)
      } else if (typeof input === 'number') {
        yield emit(Math.abs(input), span, tracker)
      } else {
        throw new RuntimeError(`Cannot take length of ${describeType(input)}`, span)
      }
    },
  },
  {
    name: 'toboolean',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(isTruthy(input), span, tracker)
    },
  },
  {
    name: 'not',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(!isTruthy(input), span, tracker)
    },
  },
]
