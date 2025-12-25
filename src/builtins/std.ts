import { RuntimeError } from '../errors'
import { describeType, isPlainObject, isTruthy, type Value, type ValueObject } from '../value'
import type { BuiltinSpec } from './types'
import { emit, stableStringify } from './utils'

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
          const newObj: ValueObject = {}
          const keys = Object.keys(curr).sort()
          let objValid = true
          for (const key of keys) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            const val = (curr as ValueObject)[key]!
            let lastVal: Value | undefined
            let found = false
            for (const walkedVal of walkRec(val)) {
              lastVal = walkedVal
              found = true
            }
            if (found) {
              newObj[key] = lastVal!
            } else {
              // If any value is empty, the reduce (and thus the object) becomes empty
              objValid = false
              break
            }
          }
          if (!objValid) return // Yield nothing
          newStruct = newObj
        }

        yield* evaluate(f, newStruct, env, tracker)
      }
      yield* walkRec(input)
    },
  },
]
