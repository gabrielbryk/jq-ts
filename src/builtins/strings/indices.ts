import { RuntimeError } from '../../errors'
import { type Value, valueEquals } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

const stringIndices = (input: string, search: string): number[] => {
  const indices: number[] = []
  // jq returns non-overlapping match positions, advancing by search.length
  // after each hit (e.g. "aaaa" | indices("aa") -> [0, 2]).
  if (search.length > 0) {
    let pos = 0
    while (pos < input.length) {
      const idx = input.indexOf(search, pos)
      if (idx === -1) break
      indices.push(idx)
      pos = idx + search.length
    }
  }
  return indices
}

const arrayIndices = (input: Value[], search: Value): number[] => {
  const indices: number[] = []
  for (let i = 0; i < input.length; i++) {
    const val = input[i]
    if (val !== undefined && valueEquals(val, search)) indices.push(i)
  }
  return indices
}

export const indicesBuiltins: BuiltinSpec[] = [
  {
    name: 'indices',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        if (Array.isArray(input)) {
          yield emit(arrayIndices(input, search), span, tracker)
        } else if (typeof input === 'string') {
          if (typeof search !== 'string') throw new RuntimeError('indices expects string', span)
          yield emit(stringIndices(input, search), span, tracker)
        } else if (input === null) {
          yield emit(null, span, tracker)
        } else {
          throw new RuntimeError('indices expects string or array', span)
        }
      }
    },
  },
]
