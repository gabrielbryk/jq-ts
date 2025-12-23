import type { FilterNode } from '../ast'
import type { LimitsConfig } from '../limits'
import type { Value } from '../value'
import type { Evaluator } from '../builtins/types'

export type { Evaluator }

/**
 * Represents a user-defined function in the environment.
 */
export interface FunctionDef {
  args: string[]
  body: FilterNode
  /** The lexical scope (closure) where the function was defined. */
  closure: EnvStack
}

/**
 * A single frame in the environment stack.
 * Stores variables and functions defined in this scope.
 */
export interface EnvFrame {
  vars: Map<string, Value>
  funcs: Map<string, FunctionDef[]>
}

/**
 * The environment stack, representing the current chain of scopes.
 * Index 0 is the global scope; the last index is the current local scope.
 */
export type EnvStack = EnvFrame[]

/**
 * Options passed to the evaluator.
 */
export interface EvalOptions {
  limits?: LimitsConfig
  /**
   * Predefined variables to seed the global environment.
   * Keys are variable names without the '$' prefix.
   */
  vars?: Record<string, Value>
}
