import { registerAllBuiltins } from './builtins/index'
import { builtins } from './builtins/registry'

// Register all modular builtins
registerAllBuiltins()

export { builtins }
export * from './builtins/types'
