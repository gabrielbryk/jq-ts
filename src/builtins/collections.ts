import { combinationBuiltins } from './collections/combinations'
import { entryBuiltins } from './collections/entries'
import { groupBuiltins } from './collections/group'
import { keyBuiltins } from './collections/keys'
import { pathBuiltins } from './collections/paths'
import { shapeBuiltins } from './collections/shape'
import { sortBuiltins } from './collections/sort'
import { transformBuiltins } from './collections/transform'
import type { BuiltinSpec } from './types'

export const collectionBuiltins: BuiltinSpec[] = [
  ...keyBuiltins,
  ...transformBuiltins,
  ...pathBuiltins,
  ...sortBuiltins,
  ...groupBuiltins,
  ...entryBuiltins,
  ...shapeBuiltins,
  ...combinationBuiltins,
]
