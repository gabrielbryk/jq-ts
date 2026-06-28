import { coerceBuiltins } from './std/coerce'
import { typeFilterBuiltins } from './std/type-filters'
import { walkBuiltin } from './std/walk'
import type { BuiltinSpec } from './types'

export const stdBuiltins: BuiltinSpec[] = [...coerceBuiltins, ...typeFilterBuiltins, walkBuiltin]
