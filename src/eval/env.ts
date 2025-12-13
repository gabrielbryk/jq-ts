import type { Value } from '../value'
import type { EnvStack } from './types'

/**
 * Retrieves a variable value from the environment stack.
 * Searches from the current (top) frame down to the global frame.
 */
export const getVar = (env: EnvStack, name: string): Value | undefined => {
  for (let i = env.length - 1; i >= 0; i--) {
    if (env[i]!.vars.has(name)) {
      return env[i]!.vars.get(name)
    }
  }
  return undefined
}

/**
 * Bounds a value to a variable name in the current scope frame.
 */
export const pushBinding = (env: EnvStack, name: string, value: Value) => {
  env[env.length - 1]!.vars.set(name, value)
}

/**
 * Removes a variable binding from the current scope frame.
 */
export const popBinding = (env: EnvStack, name: string) => {
  env[env.length - 1]!.vars.delete(name)
}
