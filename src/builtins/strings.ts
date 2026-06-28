import { affixBuiltins } from './strings/affix'
import { codecBuiltins } from './strings/codec'
import { checkContains, containsBuiltins } from './strings/contains'
import { indexOfBuiltins } from './strings/index-of'
import { indicesBuiltins } from './strings/indices'
import { transformBuiltins } from './strings/transform'
import { trimBuiltins } from './strings/trim'
import type { BuiltinSpec } from './types'

export { checkContains }

export const stringBuiltins: BuiltinSpec[] = [
  ...transformBuiltins,
  ...affixBuiltins,
  ...trimBuiltins,
  ...containsBuiltins,
  ...indexOfBuiltins,
  ...indicesBuiltins,
  ...codecBuiltins,
]
