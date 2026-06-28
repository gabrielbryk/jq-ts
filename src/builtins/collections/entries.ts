import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import { isPlainObject, type Value, type ValueObject } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit, objValue, stableStringify } from '../utils'

const ENTRY_KEY_ALIASES = ['key', 'k', 'name', 'Name', 'Key', 'K']
const ENTRY_VALUE_ALIASES = ['value', 'v', 'Value']

/**
 * Decodes a single from_entries/with_entries entry the way jq does.
 *
 * The key is resolved through the alias chain `key // k // name // Name // Key // K`
 * (the first non-null, non-false value wins) and coerced to a string via the same
 * rules as `tostring` for non-string values. The value is taken from the first
 * present of `value`, `v`, or `Value`, defaulting to `null` when absent.
 */
const decodeEntry = (item: Value, span: Span): { key: string; value: Value } => {
  if (!isPlainObject(item)) {
    throw new RuntimeError('Cannot use non-object as an entry', span)
  }
  let keyVal: Value = null
  for (const alias of ENTRY_KEY_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(item, alias)) {
      keyVal = objValue(item, alias)
      if (keyVal !== null && keyVal !== false) break
    }
  }
  const key = typeof keyVal === 'string' ? keyVal : stableStringify(keyVal)
  let value: Value = null
  for (const alias of ENTRY_VALUE_ALIASES) {
    if (Object.prototype.hasOwnProperty.call(item, alias)) {
      value = objValue(item, alias)
      break
    }
  }
  return { key, value }
}

function toEntries(input: Value, span: Span): Value[] {
  if (Array.isArray(input)) {
    return input.map((v, i) => ({ key: i, value: v }))
  }
  if (input !== null && typeof input === 'object') {
    const keys = Object.keys(input).sort()
    return keys.map((k) => ({ key: k, value: objValue(input, k) }))
  }
  throw new RuntimeError('with_entries expects array or object', span)
}

export const entryBuiltins: BuiltinSpec[] = [
  {
    name: 'to_entries',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (Array.isArray(input)) {
        const result = input.map((v, i) => ({ key: i, value: v }))
        yield emit(result, span, tracker)
      } else if (input !== null && typeof input === 'object') {
        const keys = Object.keys(input).sort()
        const result = keys.map((k) => ({ key: k, value: objValue(input, k) }))
        yield emit(result, span, tracker)
      } else {
        throw new RuntimeError('to_entries expects array or object', span)
      }
    },
  },
  {
    name: 'from_entries',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      if (!Array.isArray(input)) throw new RuntimeError('from_entries expects an array', span)
      const result: ValueObject = {}
      for (const item of input) {
        tracker.step(span)
        const { key, value } = decodeEntry(item, span)
        result[key] = value
      }
      yield emit(result, span, tracker)
    },
  },
  {
    name: 'with_entries',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      // to_entries
      const entries = toEntries(input, span)

      // map(f)
      const transformed: Value[] = []
      const filter = args[0]!
      for (const entry of entries) {
        tracker.step(span)
        for (const outVar of evaluate(filter, entry, env, tracker)) {
          transformed.push(outVar)
        }
      }

      // from_entries
      const result: ValueObject = {}
      for (const item of transformed) {
        const { key, value } = decodeEntry(item, span)
        result[key] = value
      }
      yield emit(result, span, tracker)
    },
  },
]
