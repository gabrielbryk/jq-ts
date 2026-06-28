import { RuntimeError } from '../../errors'
import { type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit, stableStringify } from '../utils'

const utf8ByteLength = (input: string): number => {
  let length = 0
  for (const char of input) {
    const codePoint = char.codePointAt(0)!
    if (codePoint <= 0x7f) length += 1
    else if (codePoint <= 0x7ff) length += 2
    else if (codePoint <= 0xffff) length += 3
    else length += 4
  }
  return length
}

export const codecBuiltins: BuiltinSpec[] = [
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
    name: 'utf8bytelength',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('utf8bytelength expects string', span)
      yield emit(utf8ByteLength(input), span, tracker)
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
  {
    name: 'tojson',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(stableStringify(input), span, tracker)
    },
  },
  {
    name: 'fromjson',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (typeof input !== 'string') throw new RuntimeError('fromjson expects string', span)
      try {
        yield emit(JSON.parse(input) as Value, span, tracker)
      } catch {
        throw new RuntimeError('fromjson could not parse JSON', span)
      }
    },
  },
]
