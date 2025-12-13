import type { Span } from './span'

/**
 * Represents a literal value in the jq AST.
 * Can be null, boolean, number, or string.
 */
export type LiteralValue = null | boolean | number | string

/**
 * Represents the identity filter `.`
 * Returns the input unchanged.
 */
export interface IdentityNode {
  kind: 'Identity'
  span: Span
}

/**
 * Represents a literal value filter (e.g., `1`, `"hello"`, `true`, `null`).
 * Outputs the literal value, ignoring the input.
 */
export interface LiteralNode {
  kind: 'Literal'
  value: LiteralValue
  span: Span
}

/**
 * Represents a variable reference (e.g., `$v`).
 */
export interface VarNode {
  kind: 'Var'
  name: string
  span: Span
}

/**
 * Represents field access using dot notation (e.g., `.foo`).
 */
export interface FieldAccessNode {
  kind: 'FieldAccess'
  target: FilterNode
  field: string
  span: Span
}

/**
 * Represents index access (e.g., `.[0]`, `.["foo"]`).
 */
export interface IndexAccessNode {
  kind: 'IndexAccess'
  target: FilterNode
  index: FilterNode
  span: Span
}

/**
 * Represents an iterator (e.g., `.[]`).
 * Iterates over the values of an array or object.
 */
export interface IterateNode {
  kind: 'Iterate'
  target: FilterNode
  span: Span
}

/**
 * Represents an array construction (e.g., `[ .a, .b ]`).
 */
export interface ArrayNode {
  kind: 'Array'
  items: FilterNode[]
  span: Span
}

/**
 * Represents an object entry in an object construction.
 */
export interface ObjectEntry {
  key: ObjectKey
  value: FilterNode
}

/**
 * Represents an object construction (e.g., `{ a: 1, b: 2 }`).
 */
export interface ObjectNode {
  kind: 'Object'
  entries: ObjectEntry[]
  span: Span
}

/**
 * Represents a key in an object construction.
 * Can be a simple identifier, a string literal, or a parenthesized expression.
 */
export type ObjectKey =
  | { kind: 'KeyIdentifier'; name: string; span: Span }
  | { kind: 'KeyString'; value: string; span: Span }
  | { kind: 'KeyExpr'; expr: FilterNode; span: Span }

/**
 * Represents the pipe operator `|`.
 * Passes the output of the left filter as input to the right filter.
 */
export interface PipeNode {
  kind: 'Pipe'
  left: FilterNode
  right: FilterNode
  span: Span
}

/**
 * Represents the comma operator `,`.
 * Outputs the results of the left filter followed by the results of the right filter.
 */
export interface CommaNode {
  kind: 'Comma'
  left: FilterNode
  right: FilterNode
  span: Span
}

/**
 * Represents the alternative operator `//`.
 * If the left filter yields empty or false/null, runs the right filter.
 */
export interface AltNode {
  kind: 'Alt'
  left: FilterNode
  right: FilterNode
  span: Span
}

/**
 * Represents unary operators (e.g., `-`, `not`).
 */
export interface UnaryNode {
  kind: 'Unary'
  op: 'Neg' | 'Not'
  expr: FilterNode
  span: Span
}

/**
 * Represents binary operators (arithmetic, comparison).
 */
export interface BinaryNode {
  kind: 'Binary'
  op: '+' | '-' | '*' | '/' | '%' | 'Eq' | 'Neq' | 'Lt' | 'Lte' | 'Gt' | 'Gte'
  left: FilterNode
  right: FilterNode
  span: Span
}

/**
 * Represents boolean binary operators (`and`, `or`).
 * These have short-circuiting behavior.
 */
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

/**
 * Represents an if-then-else expression within jq.
 * `if cond then true_branch else false_branch end`
 */
export interface IfNode {
  kind: 'If'
  branches: IfBranch[]
  else: FilterNode
  span: Span
}

/**
 * Represents a variable binding expression.
 * `expression as $var | body`
 */
export interface AsNode {
  kind: 'As'
  bind: FilterNode
  name: string
  body: FilterNode
  span: Span
}

/**
 * Represents a function call.
 * `funcname(arg1; arg2)`
 */
export interface CallNode {
  kind: 'Call'
  name: string
  args: FilterNode[]
  span: Span
}

/**
 * Represents the `reduce` expression.
 * `reduce inputs as $var (init; update)`
 */
export interface ReduceNode {
  kind: 'Reduce'
  source: FilterNode
  var: string
  init: FilterNode
  update: FilterNode
  span: Span
}

/**
 * Represents the `foreach` expression.
 * `foreach inputs as $var (init; update; extract)`
 */
export interface ForeachNode {
  kind: 'Foreach'
  source: FilterNode
  var: string
  init: FilterNode
  update: FilterNode
  extract?: FilterNode
  span: Span
}

/**
 * Represents a `try-catch` expression.
 * `try body catch handler` or `try body` (handler is null)
 */
export interface TryNode {
  kind: 'Try'
  body: FilterNode
  handler?: FilterNode
  span: Span
}

/**
 * Represents the `recurse` builtin when used as a node (deprecated/internal mainly, usually Call).
 * KEPT FOR COMPATIBILITY/Internal use.
 */
export interface RecurseNode {
  kind: 'Recurse'
  span: Span
}

/**
 * Represents assignment operators (e.g., `=`, `|=`, `+=`).
 */
export interface AssignmentNode {
  kind: 'Assignment'
  op: '=' | '|=' | '+=' | '-=' | '*=' | '/=' | '%=' | '//='
  left: FilterNode
  right: FilterNode
  span: Span
}

/**
 * Represents a function definition.
 * `def name(args): body; next`
 */
export interface DefNode {
  kind: 'Def'
  name: string
  args: string[]
  body: FilterNode
  next: FilterNode
  span: Span
}

/**
 * Represents a named label for breaking.
 * `label $out | ... break $out ...`
 */
export interface LabelNode {
  kind: 'Label'
  label: string
  body: FilterNode
  span: Span
}

/**
 * Represents a break statement targeting a label.
 * `break $out`
 */
export interface BreakNode {
  kind: 'Break'
  label: string
  span: Span
}

/**
 * Represents an array slice operation.
 * `.[start:end]`
 */
export interface SliceNode {
  kind: 'Slice'
  target: FilterNode
  start: FilterNode | null
  end: FilterNode | null
  span: Span
}

/**
 * Union of all possible AST nodes in the jq syntax tree.
 */
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
  | AssignmentNode
  | CallNode
  | ReduceNode
  | ForeachNode
  | TryNode
  | RecurseNode
  | DefNode
  | LabelNode
  | BreakNode
  | SliceNode

export type BinaryOp = BinaryNode['op']
