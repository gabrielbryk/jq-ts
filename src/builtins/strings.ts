import { RuntimeError } from '../errors'
import { describeType, isPlainObject, valueEquals, type Value } from '../value'
import type { BuiltinSpec } from './types'
import { emit } from './utils'

const checkContains = (a: Value, b: Value): boolean => {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a === 'string' && typeof b === 'string') {
    return a.includes(b)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return b.every((bItem) => a.some((aItem) => checkContains(aItem, bItem)))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(b)
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(a, key)) return false
      const valA = a[key]!
      const valB = b[key]!
      if (!checkContains(valA, valB)) return false
    }
    return true
  }
  return valueEquals(a, b)
}

export const stringBuiltins: BuiltinSpec[] = [
  {
    name: 'split',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('split input must be a string', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string')
          throw new RuntimeError('split separator must be a string', span)
        yield emit(input.split(sep), span, tracker)
      }
    },
  },
  {
    name: 'join',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (!Array.isArray(input)) throw new RuntimeError('join input must be an array', span)
      const sepGen = evaluate(args[0]!, input, env, tracker)
      for (const sep of sepGen) {
        if (typeof sep !== 'string') throw new RuntimeError('join separator must be a string', span)
        const parts: string[] = []
        for (const item of input) {
          if (typeof item !== 'string') {
            throw new RuntimeError(`join expects strings, but got ${describeType(item)}`, span)
          }
          parts.push(item)
        }
        yield emit(parts.join(sep), span, tracker)
      }
    },
  },
  {
    name: 'startswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string')
        throw new RuntimeError('startswith input must be a string', span)
      const prefixGen = evaluate(args[0]!, input, env, tracker)
      for (const prefix of prefixGen) {
        if (typeof prefix !== 'string')
          throw new RuntimeError('startswith prefix must be a string', span)
        yield emit(input.startsWith(prefix), span, tracker)
      }
    },
  },
  {
    name: 'endswith',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      if (typeof input !== 'string') throw new RuntimeError('endswith input must be a string', span)
      const suffixGen = evaluate(args[0]!, input, env, tracker)
      for (const suffix of suffixGen) {
        if (typeof suffix !== 'string')
          throw new RuntimeError('endswith suffix must be a string', span)
        yield emit(input.endsWith(suffix), span, tracker)
      }
    },
  },
  {
    name: 'contains',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const bGen = evaluate(args[0]!, input, env, tracker)
      for (const b of bGen) {
        yield emit(checkContains(input, b), span, tracker)
      }
    },
  },
  {
    name: 'index',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        if (Array.isArray(input)) {
          // jq index on array: returns index of first occurrence of search value
          let foundIndex: number | null = null
          for (let i = 0; i < input.length; i++) {
            const val = input[i]
            if (val !== undefined && valueEquals(val, search)) {
              foundIndex = i
              break
            }
          }
          yield emit(foundIndex, span, tracker) // jq returns null if not found
        } else if (typeof input === 'string') {
          if (typeof search !== 'string')
            throw new RuntimeError('index expects string search when input is string', span)
          const idx = input.indexOf(search)
          yield emit(idx === -1 ? null : idx, span, tracker)
        } else {
          // jq index on null? null.
          if (input === null) yield emit(null, span, tracker)
          else throw new RuntimeError('index expects string or array', span)
        }
      }
    },
  },
  {
    name: 'rindex',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // rindex only defined for strings in jq documentation? "index, rindex, indices" -> "match input against..."
      // jq `[1,2,1] | rindex(1)` -> 2.
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        if (Array.isArray(input)) {
          let foundIndex: number | null = null
          for (let i = input.length - 1; i >= 0; i--) {
            const val = input[i]
            if (val !== undefined && valueEquals(val, search)) {
              foundIndex = i
              break
            }
          }
          yield emit(foundIndex, span, tracker)
        } else if (typeof input === 'string') {
          if (typeof search !== 'string')
            throw new RuntimeError('rindex expects string search when input is string', span)
          const idx = input.lastIndexOf(search)
          yield emit(idx === -1 ? null : idx, span, tracker)
        } else {
          if (input === null) yield emit(null, span, tracker)
          else throw new RuntimeError('rindex expects string or array', span)
        }
      }
    },
  },
  {
    name: 'indices',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const searchGen = evaluate(args[0]!, input, env, tracker)
      for (const search of searchGen) {
        const indices: number[] = []
        if (Array.isArray(input)) {
          for (let i = 0; i < input.length; i++) {
            const val = input[i]
            if (val !== undefined && valueEquals(val, search)) indices.push(i)
          }
        } else if (typeof input === 'string') {
          if (typeof search !== 'string') throw new RuntimeError('indices expects string', span)
          // Overlapping? jq `indices` documentation says "array of indices".
          // jq `"aba" | indices("a")` -> `[0, 2]`.
          // jq `"aba" | indices("ba")` -> `[1]`.
          // Use indexOf loop
          if (search.length === 0) {
            // Special case: empty string?
          } else {
            let pos = 0
            while (pos < input.length) {
              const idx = input.indexOf(search, pos)
              if (idx === -1) break
              indices.push(idx)
              pos = idx + 1 // allow overlapping? jq "aba" "aba" -> ?
              // jq: `"abab" | indices("aba")` -> `[0]`. (No overlap)
              // So advance by length?
              // Wait, jq manual might specify overlap.
              // Usually `indices` does NOT overlap.
              // Just `pos = idx + 1` finds all starts?
              // If I have "aaaa" and search "aa". `indexOf` at 0 -> 0. `indexOf` at 1 -> 1.
              // Does jq return `[0, 1, 2]`?
              // Checked jq: `"aaaa" | indices("aa")` -> `[0, 2]`. (Non-overlapping!)
              // So `pos = idx + search.length`.
              pos = idx + search.length
            }
          }
        } else {
          if (input === null) {
            yield emit(null, span, tracker)
            continue
          }
          throw new RuntimeError('indices expects string or array', span)
        }
        yield emit(indices, span, tracker)
      }
    },
  },
  {
    name: 'explode',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('explode expects string', span)
      // JS strings are UTF-16. `explode` expects codepoints.
      // Array.from(str) splits by code point (surrogate pairs handled).
      // Then map to codePointAt(0).
      const codes = Array.from(input).map((c) => c.codePointAt(0)!)
      yield emit(codes, span, tracker)
    },
  },
  {
    name: 'implode',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('implode expects array', span)
      const chars: string[] = []
      for (const item of input) {
        if (typeof item !== 'number') throw new RuntimeError('implode item must be number', span)
        chars.push(String.fromCodePoint(item))
      }
      yield emit(chars.join(''), span, tracker)
    },
  },
]
