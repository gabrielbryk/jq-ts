import type { Span } from './span'

export type LiteralValue = null | boolean | number | string

export interface IdentityNode {
  kind: 'Identity'
  span: Span
}

export interface LiteralNode {
  kind: 'Literal'
  value: LiteralValue
  span: Span
}

export interface VarNode {
  kind: 'Var'
  name: string
  span: Span
}

export interface FieldAccessNode {
  kind: 'FieldAccess'
  target: FilterNode
  field: string
  span: Span
}

export interface IndexAccessNode {
  kind: 'IndexAccess'
  target: FilterNode
  index: FilterNode
  span: Span
}

export interface IterateNode {
  kind: 'Iterate'
  target: FilterNode
  span: Span
}

export interface ArrayNode {
  kind: 'Array'
  items: FilterNode[]
  span: Span
}

export interface ObjectEntry {
  key: ObjectKey
  value: FilterNode
}

export interface ObjectNode {
  kind: 'Object'
  entries: ObjectEntry[]
  span: Span
}

export type ObjectKey =
  | { kind: 'KeyIdentifier'; name: string; span: Span }
  | { kind: 'KeyString'; value: string; span: Span }
  | { kind: 'KeyExpr'; expr: FilterNode; span: Span }

export interface PipeNode {
  kind: 'Pipe'
  left: FilterNode
  right: FilterNode
  span: Span
}

export interface CommaNode {
  kind: 'Comma'
  left: FilterNode
  right: FilterNode
  span: Span
}

export interface AltNode {
  kind: 'Alt'
  left: FilterNode
  right: FilterNode
  span: Span
}

export interface UnaryNode {
  kind: 'Unary'
  op: 'Neg' | 'Not'
  expr: FilterNode
  span: Span
}

export interface BinaryNode {
  kind: 'Binary'
  op: '+' | '-' | '*' | '/' | '%' | 'Eq' | 'Neq' | 'Lt' | 'Lte' | 'Gt' | 'Gte'
  left: FilterNode
  right: FilterNode
  span: Span
}

export interface BoolNode {
  kind: 'Bool'
  op: 'And' | 'Or'
  left: FilterNode
  right: FilterNode
  span: Span
}

export interface IfBranch {
  cond: FilterNode
  then: FilterNode
}

export interface IfNode {
  kind: 'If'
  branches: IfBranch[]
  else: FilterNode
  span: Span
}

export interface AsNode {
  kind: 'As'
  bind: FilterNode
  name: string
  body: FilterNode
  span: Span
}

export interface CallNode {
  kind: 'Call'
  name: string
  args: FilterNode[]
  span: Span
}

export interface ReduceNode {
  kind: 'Reduce'
  source: FilterNode
  var: string
  init: FilterNode
  update: FilterNode
  span: Span
}

export interface ForeachNode {
  kind: 'Foreach'
  source: FilterNode
  var: string
  init: FilterNode
  update: FilterNode
  extract?: FilterNode
  span: Span
}

export interface TryNode {
  kind: 'Try'
  body: FilterNode
  handler?: FilterNode
  span: Span
}

export interface RecurseNode {
  kind: 'Recurse'
  span: Span
}

export type FilterNode =
  | IdentityNode
  | LiteralNode
  | VarNode
  | FieldAccessNode
  | IndexAccessNode
  | IterateNode
  | ArrayNode
  | ObjectNode
  | PipeNode
  | CommaNode
  | AltNode
  | UnaryNode
  | BinaryNode
  | BoolNode
  | IfNode
  | AsNode
  | CallNode
  | ReduceNode
  | ForeachNode
  | TryNode
  | RecurseNode

export type BinaryOp = BinaryNode['op']
