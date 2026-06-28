import { isPlainObject, type Value } from '../../value'
import type { BuiltinSpec } from '../types'
import { emit } from '../utils'

const typeFilter = (name: string, predicate: (input: Value) => boolean): BuiltinSpec => ({
  name,
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    if (predicate(input)) yield emit(input, span, tracker)
  },
})

export const typeFilterBuiltins: BuiltinSpec[] = [
  typeFilter('arrays', (input) => Array.isArray(input)),
  typeFilter('objects', (input) => isPlainObject(input)),
  typeFilter('iterables', (input) => Array.isArray(input) || isPlainObject(input)),
  typeFilter('booleans', (input) => typeof input === 'boolean'),
  typeFilter('numbers', (input) => typeof input === 'number'),
  typeFilter('strings', (input) => typeof input === 'string'),
  typeFilter('nulls', (input) => input === null),
  typeFilter('values', (input) => input !== null),
  typeFilter('scalars', (input) => input === null || typeof input !== 'object'),
  typeFilter('finites', (input) => typeof input === 'number' && Number.isFinite(input)),
  typeFilter(
    'normals',
    (input) => typeof input === 'number' && Number.isFinite(input) && input !== 0
  ),
  {
    name: 'empty',
    arity: 0,
    apply: function* () {
      // Do nothing, yield nothing
    },
  },
]
