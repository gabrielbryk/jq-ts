import { RuntimeError } from '../errors'
import { describeType, isPlainObject, isTruthy, type Value, type ValueObject } from '../value'
import type { BuiltinSpec } from './types'
import { emit, objValue, stableStringify } from './utils'

const toJqString = (value: Value): string => {
  if (typeof value === 'string') return value
  return stableStringify(value)
}

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
    name: 'arrays',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) yield emit(input, span, tracker)
    },
  },
  {
    name: 'objects',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (isPlainObject(input)) yield emit(input, span, tracker)
    },
  },
  {
    name: 'iterables',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input) || isPlainObject(input)) yield emit(input, span, tracker)
    },
  },
  {
    name: 'booleans',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'boolean') yield emit(input, span, tracker)
    },
  },
  {
    name: 'numbers',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'number') yield emit(input, span, tracker)
    },
  },
  {
    name: 'strings',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'string') yield emit(input, span, tracker)
    },
  },
  {
    name: 'nulls',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (input === null) yield emit(input, span, tracker)
    },
  },
  {
    name: 'values',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (input !== null) yield emit(input, span, tracker)
    },
  },
  {
    name: 'scalars',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (input === null || typeof input !== 'object') yield emit(input, span, tracker)
    },
  },
  {
    name: 'finites',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'number' && Number.isFinite(input)) yield emit(input, span, tracker)
    },
  },
  {
    name: 'normals',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input === 'number' && Number.isFinite(input) && input !== 0) {
        yield emit(input, span, tracker)
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
  {
    name: 'walk',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const f = args[0]!
      const walkRec = function* (curr: Value): Generator<Value> {
        tracker.step(span)
        let newStruct: Value = curr

        if (Array.isArray(curr)) {
          const newArr: Value[] = []
          for (const item of curr) {
            for (const walkedItem of walkRec(item)) {
              newArr.push(walkedItem)
            }
          }
          newStruct = newArr
        } else if (isPlainObject(curr)) {
          // jq: map_values(w) === .[] |= w — the first output of w replaces each
          // value, and a key is dropped when w yields nothing for it.
          const newObj: ValueObject = {}
          const keys = Object.keys(curr).sort()
          for (const key of keys) {
            const val = objValue(curr, key)
            for (const walkedVal of walkRec(val)) {
              newObj[key] = walkedVal
              break
            }
          }
          newStruct = newObj
        }

        yield* evaluate(f, newStruct, env, tracker)
      }
      yield* walkRec(input)
    },
  },
]
