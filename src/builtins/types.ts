import type { FilterNode } from '../ast'
import type { Span } from '../span'
import type { Value } from '../value'
import type { LimitTracker } from '../limits'
import type { EnvStack } from '../eval/types'

export type Evaluator = (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker
) => Generator<Value>

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
