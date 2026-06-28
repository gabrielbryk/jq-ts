import type { BindingPattern } from '../ast'
import { RuntimeError } from '../errors'
import { describeType, isPlainObject } from '../value'
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
 * Binds jq `as` destructuring patterns into a variable map.
 */
const bindPattern = (pattern: BindingPattern, value: Value, bindings: Map<string, Value>): void => {
  switch (pattern.kind) {
    case 'VariablePattern':
      bindings.set(pattern.name, value)
      return
    case 'ArrayPattern': {
      if (!Array.isArray(value)) {
        throw new RuntimeError(`Cannot index ${describeType(value)} with number`, pattern.span)
      }
      pattern.items.forEach((item, index) => {
        bindPattern(item, index < value.length ? value[index]! : null, bindings)
      })
      return
    }
    case 'ObjectPattern': {
      if (!isPlainObject(value)) {
        throw new RuntimeError(`Cannot index ${describeType(value)} with string`, pattern.span)
      }
      for (const entry of pattern.entries) {
        bindPattern(
          entry.pattern,
          Object.prototype.hasOwnProperty.call(value, entry.key) ? value[entry.key]! : null,
          bindings
        )
      }
      return
    }
  }
}

/**
 * Pushes a new scope onto the environment stack, binding `pattern` to `value`
 * in a fresh variable frame (with its own empty function map). Used by `as`,
 * `reduce`, and `foreach` to scope their loop bindings.
 */
export const bindFrame = (pattern: BindingPattern, value: Value, env: EnvStack): EnvStack => {
  const vars = new Map<string, Value>()
  bindPattern(pattern, value, vars)
  return [...env, { vars, funcs: new Map() }]
}
