import { RuntimeError } from '../errors'
import { describeType } from '../value'
import type { BuiltinSpec } from './types'
import { emit, stableStringify } from './utils'

export const stdBuiltins: BuiltinSpec[] = [
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
      yield emit(stableStringify(input), span, tracker)
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
        // Safe because isPlainObject check implies it's not null/array, but here we can just use Object.keys
        yield emit(Object.keys(input).length, span, tracker)
      } else {
        throw new RuntimeError(`Cannot take length of ${describeType(input)}`, span)
      }
    },
  },
  {
    name: 'empty',
    arity: 0,
    apply: function* () {
      // Do nothing, yield nothing
    },
  },
]
