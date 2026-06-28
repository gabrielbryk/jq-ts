import type { FilterNode } from './ast'
import type { LimitTracker } from './limits'
import type { Span } from './span'
import type { Value } from './value'

/**
 * A user-defined function captured in the environment.
 */
export interface FunctionDef {
  args: string[]
  body: FilterNode
  /** The lexical scope (closure) where the function was defined. */
  closure: EnvStack
}

/**
 * A single frame in the environment stack: the variables and functions
 * defined in one scope.
 */
export interface EnvFrame {
  vars: Map<string, Value>
  funcs: Map<string, FunctionDef[]>
}

/**
 * The environment stack — the current chain of scopes. Index 0 is the global
 * scope; the last index is the innermost local scope.
 */
export type EnvStack = EnvFrame[]

/**
 * Evaluates an AST node against an input value, yielding the stream of results.
 * This is the recursive callback threaded into builtins.
 */
export type Evaluator = (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
) => Generator<Value>

/**
 * The contract every builtin implements: a name, an arity, and a generator
 * that produces the builtin's output stream.
 */
export interface BuiltinSpec {
  name: string
  arity: number
  apply: (
    input: Value,
    args: FilterNode[],
    env: EnvStack,
    tracker: LimitTracker,
    evaluate: Evaluator,
    span: Span
  ) => Generator<Value>
}
