import { allBuiltins } from './iterators/all'
import { anyBuiltins } from './iterators/any'
import { generatorBuiltins } from './iterators/generators'
import { limitBuiltins } from './iterators/limit'
import { loopBuiltins } from './iterators/loops'
import { nthBuiltins } from './iterators/nth'
import { recurseBuiltins } from './iterators/recurse'
import type { BuiltinSpec } from './types'

export const iteratorBuiltins: BuiltinSpec[] = [
  // --- Generators ---
  ...generatorBuiltins,
  // --- Iterators ---
  ...limitBuiltins,
  ...nthBuiltins,
  // --- Aggregators ---
  ...allBuiltins,
  ...anyBuiltins,
  ...recurseBuiltins,
  ...loopBuiltins,
]
