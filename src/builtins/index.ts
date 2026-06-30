import { collectionBuiltins } from './collections'
import { dateBuiltins } from './dates'
import { errorBuiltins } from './errors'
import { iteratorBuiltins } from './iterators'
import { mathBuiltins } from './math'
import { pathBuiltins } from './paths'
import { regexBuiltins } from './regex'
import { registerBuiltins } from './registry'
import { sqlBuiltins } from './sql'
import { stdBuiltins } from './std'
import { streamingBuiltins } from './streaming'
import { stringBuiltins } from './strings'

export const registerAllBuiltins = () => {
  registerBuiltins(stdBuiltins)
  registerBuiltins(errorBuiltins)
  registerBuiltins(collectionBuiltins)
  registerBuiltins(stringBuiltins)
  registerBuiltins(pathBuiltins)
  registerBuiltins(iteratorBuiltins)
  registerBuiltins(mathBuiltins)
  registerBuiltins(dateBuiltins)
  registerBuiltins(regexBuiltins)
  registerBuiltins(streamingBuiltins)
  registerBuiltins(sqlBuiltins)
}
