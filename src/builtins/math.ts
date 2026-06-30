import { classifyBuiltins } from './math/classify'
import { explogBuiltins } from './math/explog'
import { extremaBuiltins } from './math/extrema'
import { extremaByBuiltins } from './math/extrema_by'
import { finitenessBuiltins } from './math/finiteness'
import { hyperbolicBuiltins } from './math/hyperbolic'
import { roundingBuiltins } from './math/rounding'
import { scalar2Builtins } from './math/scalar2'
import { sumBuiltins } from './math/sum'
import { trigBuiltins } from './math/trig'
import type { BuiltinSpec } from './types'

export const mathBuiltins: BuiltinSpec[] = [
  ...roundingBuiltins,
  ...classifyBuiltins,
  ...finitenessBuiltins,
  ...extremaBuiltins,
  ...extremaByBuiltins,
  ...sumBuiltins,
  ...trigBuiltins,
  ...hyperbolicBuiltins,
  ...explogBuiltins,
  ...scalar2Builtins,
]
