import { registerBuiltins } from './registry'
import { stdBuiltins } from './std'
import { errorBuiltins } from './errors'
import { collectionBuiltins } from './collections'
import { stringBuiltins } from './strings'
import { pathBuiltins } from './paths'
import { iteratorBuiltins } from './iterators'
import { mathBuiltins } from './math'

export const registerAllBuiltins = () => {
  registerBuiltins(stdBuiltins)
  registerBuiltins(errorBuiltins)
  registerBuiltins(collectionBuiltins)
  registerBuiltins(stringBuiltins)
  registerBuiltins(pathBuiltins)
  registerBuiltins(iteratorBuiltins)
  registerBuiltins(mathBuiltins)
}
