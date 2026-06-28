import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import { type Value, valueEquals } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

const arrayFindIndex = (input: Value[], search: Value, fromEnd: boolean): number | null => {
  if (fromEnd) {
    for (let i = input.length - 1; i >= 0; i--) {
      const val = input[i]
      if (val !== undefined && valueEquals(val, search)) return i
    }
  } else {
    for (let i = 0; i < input.length; i++) {
      const val = input[i]
      if (val !== undefined && valueEquals(val, search)) return i
    }
  }
  return null
}

// Shared body for `index` (fromEnd=false) and `rindex` (fromEnd=true): both
// return the matching position in a string/array, null for null input/no match.
const findOne = (
  name: string,
  input: Value,
  search: Value,
  fromEnd: boolean,
  span: Span
): number | null => {
  if (Array.isArray(input)) {
    return arrayFindIndex(input, search, fromEnd)
  }
  if (typeof input === 'string') {
    if (typeof search !== 'string')
      throw new RuntimeError(`${name} expects string search when input is string`, span)
    const idx = fromEnd ? input.lastIndexOf(search) : input.indexOf(search)
    return idx === -1 ? null : idx
  }
  if (input === null) return null
  throw new RuntimeError(`${name} expects string or array`, span)
}

export const indexOfBuiltins: BuiltinSpec[] = [
  {
    name: 'index',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        yield emit(findOne('index', input, search, false, span), span, tracker)
      }
    },
  },
  {
    name: 'rindex',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // rindex returns the last index of search in a string or array (null if absent).
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        yield emit(findOne('rindex', input, search, true, span), span, tracker)
      }
    },
  },
]
