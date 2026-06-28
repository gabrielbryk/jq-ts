import { isPlainObject, type Value, type ValueObject } from '../../value'
import type { BuiltinSpec } from '../types'
import { objValue } from '../utils'

export const walkBuiltin: BuiltinSpec = {
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
}
