import { classifyBuiltins } from './math/classify'
import { extremaBuiltins } from './math/extrema'
import { extremaByBuiltins } from './math/extrema_by'
import { finitenessBuiltins } from './math/finiteness'
import { roundingBuiltins } from './math/rounding'
import { sumBuiltins } from './math/sum'
import type { BuiltinSpec } from './types'

export const mathBuiltins: BuiltinSpec[] = [
  ...roundingBuiltins,
  ...classifyBuiltins,
  ...finitenessBuiltins,
  ...extremaBuiltins,
  ...extremaByBuiltins,
  ...sumBuiltins,
]
