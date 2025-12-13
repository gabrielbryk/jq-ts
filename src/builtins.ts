import { registerAllBuiltins } from './builtins/index'
import { builtins } from './builtins/registry'

// Register all modular builtins
registerAllBuiltins()

export { builtins }
export * from './builtins/types'
export { stdBuiltins } from './builtins/std'
export { errorBuiltins } from './builtins/errors'
export { collectionBuiltins } from './builtins/collections'
export { stringBuiltins } from './builtins/strings'
export { pathBuiltins } from './builtins/paths'
export { iteratorBuiltins } from './builtins/iterators'
export { mathBuiltins } from './builtins/math'
