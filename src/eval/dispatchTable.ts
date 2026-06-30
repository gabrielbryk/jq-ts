import type {
  AltNode,
  ArrayNode,
  AsNode,
  AssignmentNode,
  BinaryNode,
  BoolNode,
  BreakNode,
  CallNode,
  CommaNode,
  DefNode,
  FieldAccessNode,
  FilterNode,
  ForeachNode,
  FormatNode,
  IdentityNode,
  IfNode,
  IndexAccessNode,
  IterateNode,
  LabelNode,
  LiteralNode,
  ObjectNode,
  PipeNode,
  RecurseNode,
  ReduceNode,
  SliceNode,
  TryNode,
  UnaryNode,
  VarNode,
} from '../ast'
import type { LimitTracker } from '../limits'
import type { Evaluator } from '../types'
import type { Value } from '../value'
import { evalField, evalIndex, evalSlice } from './access'
import { evalAssignment } from './assignment'
import { BreakSignal } from './break'
import { buildArray, buildObjects } from './constructors'
import { evalIf, evalLabel, evalTry } from './controlFlow'
import { evalAlt, evalAs, evalComma, evalPipe, evalVar } from './dispatchHandlers'
import { evalBinary, evalBool, evalUnary } from './dispatchOperators'
import { evalIdentity, evalLiteral } from './dispatchScalars'
import { evalFormat } from './format'
import { evalCall, evalDef } from './functions'
import { evalForeach, evalIterate, evalRecurse, evalReduce } from './iterators'
import type { EnvStack } from './types'

/**
 * A uniform per-node-kind evaluation handler. Each handler receives the full
 * evaluation context plus the recursive `evaluate` callback and yields the
 * stream of values for that node.
 */
export type NodeHandler = (
  node: FilterNode,
  input: Value,
  env: EnvStack,
  tracker: LimitTracker,
  evaluate: Evaluator
) => Generator<Value, void, undefined>

/**
 * Dispatch table mapping each AST node kind to its evaluation handler. Replaces
 * a large `switch` so the core `evaluate` loop stays a thin lookup.
 */
export const handlers: Record<FilterNode['kind'], NodeHandler> = {
  Identity: (node, input, _env, tracker) => evalIdentity(node as IdentityNode, input, tracker),
  Literal: (node, _input, _env, tracker) => evalLiteral(node as LiteralNode, tracker),
  Var: (node, _input, env, tracker) => evalVar(node as VarNode, env, tracker),
  FieldAccess: (node, input, env, tracker, evaluate) =>
    evalField(node as FieldAccessNode, input, env, tracker, evaluate),
  IndexAccess: (node, input, env, tracker, evaluate) =>
    evalIndex(node as IndexAccessNode, input, env, tracker, evaluate),
  Slice: (node, input, env, tracker, evaluate) =>
    evalSlice(node as SliceNode, input, env, tracker, evaluate),
  Array: (node, input, env, tracker, evaluate) =>
    buildArray(node as ArrayNode, input, env, tracker, evaluate),
  Object: (node, input, env, tracker, evaluate) =>
    buildObjects(node as ObjectNode, input, env, tracker, evaluate),
  Label: (node, input, env, tracker, evaluate) =>
    evalLabel(node as LabelNode, input, env, tracker, evaluate),
  // The Break handler always throws and never yields, so require-yield does not apply.
  // eslint-disable-next-line require-yield
  Break: function* breakHandler(node) {
    throw new BreakSignal((node as BreakNode).label)
  },
  Pipe: (node, input, env, tracker, evaluate) =>
    evalPipe(node as PipeNode, input, env, tracker, evaluate),
  Comma: (node, input, env, tracker, evaluate) =>
    evalComma(node as CommaNode, input, env, tracker, evaluate),
  Alt: (node, input, env, tracker, evaluate) =>
    evalAlt(node as AltNode, input, env, tracker, evaluate),
  Unary: (node, input, env, tracker, evaluate) =>
    evalUnary(node as UnaryNode, input, env, tracker, evaluate),
  Bool: (node, input, env, tracker, evaluate) =>
    evalBool(node as BoolNode, input, env, tracker, evaluate),
  Binary: (node, input, env, tracker, evaluate) =>
    evalBinary(node as BinaryNode, input, env, tracker, evaluate),
  If: (node, input, env, tracker, evaluate) =>
    evalIf(node as IfNode, input, env, tracker, evaluate),
  Try: (node, input, env, tracker, evaluate) =>
    evalTry(node as TryNode, input, env, tracker, evaluate),
  Recurse: (node, input, env, tracker, evaluate) =>
    evalRecurse(node as RecurseNode, input, env, tracker, evaluate),
  Iterate: (node, input, env, tracker, evaluate) =>
    evalIterate(node as IterateNode, input, env, tracker, evaluate),
  Assignment: (node, input, env, tracker, evaluate) =>
    evalAssignment(node as AssignmentNode, input, env, tracker, evaluate),
  Reduce: (node, input, env, tracker, evaluate) =>
    evalReduce(node as ReduceNode, input, env, tracker, evaluate),
  Foreach: (node, input, env, tracker, evaluate) =>
    evalForeach(node as ForeachNode, input, env, tracker, evaluate),
  As: (node, input, env, tracker, evaluate) =>
    evalAs(node as AsNode, input, env, tracker, evaluate),
  Call: (node, input, env, tracker, evaluate) =>
    evalCall(node as CallNode, input, env, tracker, evaluate),
  Def: (node, input, env, tracker, evaluate) =>
    evalDef(node as DefNode, input, env, tracker, evaluate),
  Format: (node, input, env, tracker, evaluate) =>
    evalFormat(node as FormatNode, input, env, tracker, evaluate),
}
