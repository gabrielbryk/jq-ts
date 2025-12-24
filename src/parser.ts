import { ParseError } from './errors'
import { lex } from './lexer'
import type { Span } from './span'
import type { Token, TokenKind } from './tokens'
import type {
  FilterNode,
  LiteralValue,
  ArrayNode,
  ObjectEntry,
  ObjectKey,
  ObjectNode,
  BinaryOp,
  TryNode,
  ReduceNode,
  ForeachNode,
  AssignmentNode,
} from './ast'

/**
 * Parses a jq source string into an Abstract Syntax Tree (AST).
 *
 * @param source - The input jq query string.
 * @returns The root {@link FilterNode} of the AST.
 * @throws {LexError} If the source contains invalid characters.
 * @throws {ParseError} If the syntax is invalid.
 */
export const parse = (source: string): FilterNode => {
  const parser = new Parser(lex(source))
  return parser.parseFilter()
}

class Parser {
  private current = 0

  constructor(private readonly tokens: Token[]) {}

  parseFilter(): FilterNode {
    const expr = this.parseDef()
    this.consume('EOF', 'Expected end of expression')
    return expr
  }

  private parseDef(allowComma = true): FilterNode {
    if (this.match('Def')) {
      const startSpan = this.previous().span
      const nameToken = this.consume('Identifier', 'Expected function name')
      const name = String(nameToken.value)

      const args: string[] = []
      if (this.match('LParen')) {
        if (!this.check('RParen')) {
          do {
            const argToken = this.consume('Identifier', 'Expected argument name')
            args.push(String(argToken.value))
          } while (this.match('Semicolon'))
        }
        this.consume('RParen', 'Expected ")" after arguments')
      }

      this.consume('Colon', 'Expected ":" after function signature')
      // Function body always supports comma
      const body = this.parseDef(true)

      this.consume('Semicolon', 'Expected ";" after function body')
      // Next expression inherits restriction?
      // Def block ends with ; so it is safe. Next expression logic:
      // def a: 1; b, c
      // If we are in allowComma=false context (e.g. object), b, c is invalid.
      // So next expression MUST respect allowComma.
      const next = this.parseDef(allowComma)

      return {
        kind: 'Def',
        name,
        args,
        body,
        next,
        span: spanBetween(startSpan, next.span),
      }
    }
    return this.parseBinding(allowComma)
  }

  private parseBinding(allowComma = true): FilterNode {
    if (this.match('Label')) {
      const start = this.previous()
      const varToken = this.consume('Variable', 'Expected variable name after "label"')
      this.consume('Pipe', 'Expected "|" after label')
      const body = this.parseBinding(allowComma)
      return {
        kind: 'Label',
        label: String(varToken.value),
        body,
        span: spanBetween(start.span, body.span),
      }
    }

    let expr = this.parsePipe(allowComma)
    while (this.match('As')) {
      const varToken = this.consume('Variable', 'Expected variable name after "as"')
      this.consume('Pipe', 'Expected "|" after variable binding')
      const body = this.parseBinding(allowComma)
      expr = {
        kind: 'As',
        bind: expr,
        name: String(varToken.value),
        body,
        span: spanBetween(expr.span, body.span),
      }
    }
    return expr
  }

  private parsePipe(allowComma = true): FilterNode {
    let expr = this.parseComma(allowComma)
    while (this.match('Pipe')) {
      const right = this.parseComma(allowComma)
      expr = {
        kind: 'Pipe',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parseComma(allowComma = true): FilterNode {
    let expr = this.parseAssignment()
    if (!allowComma) return expr
    while (this.match('Comma')) {
      const right = this.parseAssignment()
      expr = {
        kind: 'Comma',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parseAssignment(): FilterNode {
    const expr = this.parseAlt()
    if (
      this.match('Eq') ||
      this.match('BarEq') ||
      this.match('PlusEq') ||
      this.match('MinusEq') ||
      this.match('StarEq') ||
      this.match('SlashEq') ||
      this.match('PercentEq') ||
      this.match('AltEq')
    ) {
      const opToken = this.previous()
      const right = this.parseAssignment() // Right-associative
      let op: AssignmentNode['op']
      switch (opToken.kind) {
        case 'Eq':
          op = '='
          break
        case 'BarEq':
          op = '|='
          break
        case 'PlusEq':
          op = '+='
          break
        case 'MinusEq':
          op = '-='
          break
        case 'StarEq':
          op = '*='
          break
        case 'SlashEq':
          op = '/='
          break
        case 'PercentEq':
          op = '%='
          break
        case 'AltEq':
          op = '//='
          break
        default:
          throw new Error(`Unknown assignment op: ${opToken.kind}`)
      }
      return {
        kind: 'Assignment',
        op,
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parsePipeOperand(): FilterNode {
    return this.parseAlt()
  }

  private parseAlt(): FilterNode {
    let expr = this.parseOr()
    while (this.match('Alt')) {
      const right = this.parseOr()
      expr = {
        kind: 'Alt',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parseOr(): FilterNode {
    let expr = this.parseAnd()
    while (this.match('Or')) {
      const right = this.parseAnd()
      expr = {
        kind: 'Bool',
        op: 'Or',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parseAnd(): FilterNode {
    let expr = this.parseComparison()
    while (this.match('And')) {
      const right = this.parseComparison()
      expr = {
        kind: 'Bool',
        op: 'And',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parseComparison(): FilterNode {
    let expr = this.parseAdd()
    while (true) {
      if (this.match('EqualEqual')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Eq')
      } else if (this.match('BangEqual')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Neq')
      } else if (this.match('Less')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Lt')
      } else if (this.match('LessEqual')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Lte')
      } else if (this.match('Greater')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Gt')
      } else if (this.match('GreaterEqual')) {
        const right = this.parseAdd()
        expr = this.makeBinary(expr, right, 'Gte')
      } else {
        break
      }
    }
    return expr
  }

  private parseAdd(): FilterNode {
    let expr = this.parseMul()
    while (true) {
      if (this.match('Plus')) {
        const right = this.parseMul()
        expr = this.makeBinary(expr, right, '+')
      } else if (this.match('Minus')) {
        const right = this.parseMul()
        expr = this.makeBinary(expr, right, '-')
      } else {
        break
      }
    }
    return expr
  }

  private parseMul(): FilterNode {
    let expr = this.parseUnary()
    while (true) {
      if (this.match('Star')) {
        const right = this.parseUnary()
        expr = this.makeBinary(expr, right, '*')
      } else if (this.match('Slash')) {
        const right = this.parseUnary()
        expr = this.makeBinary(expr, right, '/')
      } else if (this.match('Percent')) {
        const right = this.parseUnary()
        expr = this.makeBinary(expr, right, '%')
      } else {
        break
      }
    }
    return expr
  }

  private parseUnary(): FilterNode {
    if (this.match('Not')) {
      const op = this.previous()
      const expr = this.parseUnary()
      return {
        kind: 'Unary',
        op: 'Not',
        expr,
        span: spanBetween(op.span, expr.span),
      }
    }
    if (this.match('Minus')) {
      const op = this.previous()
      const expr = this.parseUnary()
      return {
        kind: 'Unary',
        op: 'Neg',
        expr,
        span: spanBetween(op.span, expr.span),
      }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): FilterNode {
    let expr = this.parsePrimary()
    while (true) {
      if (this.match('Dot')) {
        expr = this.finishFieldAccess(expr)
        continue
      }
      if (this.match('LBracket')) {
        // Check for [:end]
        if (this.match('Colon')) {
          let end: FilterNode | null = null
          if (!this.check('RBracket')) {
            end = this.parsePipe()
          }
          const close = this.consume('RBracket', 'Expected "]" after slice')
          expr = {
            kind: 'Slice',
            target: expr,
            start: null,
            end,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        if (this.match('RBracket')) {
          const close = this.previous()
          expr = {
            kind: 'Iterate',
            target: expr,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        const index = this.parsePipe()

        if (this.match('Colon')) {
          let end: FilterNode | null = null
          if (!this.check('RBracket')) {
            end = this.parsePipe()
          }
          const close = this.consume('RBracket', 'Expected "]" after slice')
          expr = {
            kind: 'Slice',
            target: expr,
            start: index,
            end,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        const closing = this.consume('RBracket', 'Expected "]" after index expression')
        expr = {
          kind: 'IndexAccess',
          target: expr,
          index,
          span: spanBetween(expr.span, closing.span),
        }
        continue
      }
      if (this.match('Question')) {
        const op = this.previous()
        expr = {
          kind: 'Try',
          body: expr,
          handler: { kind: 'Identity', span: op.span } as FilterNode,
          span: spanBetween(expr.span, op.span),
        }
        continue
      }
      break
    }
    return expr
  }

  private parsePrimary(): FilterNode {
    if (this.match('Dot')) {
      return this.parseLeadingDot(this.previous())
    }
    if (this.match('Null')) return this.literalNode(null, this.previous().span)
    if (this.match('True')) return this.literalNode(true, this.previous().span)
    if (this.match('False')) return this.literalNode(false, this.previous().span)
    if (this.match('Number')) {
      return this.literalNode(Number(this.previous().value), this.previous().span)
    }
    if (this.match('String')) {
      return this.literalNode(String(this.previous().value), this.previous().span)
    }
    if (this.match('StringStart')) {
      return this.parseStringInterpolation(this.previous())
    }
    if (this.match('Variable')) {
      const token = this.previous()
      return {
        kind: 'Var',
        name: String(token.value),
        span: token.span,
      }
    }
    if (this.match('Identifier')) {
      return this.finishIdentifier(this.previous())
    }
    if (this.match('If')) {
      return this.parseIf(this.previous())
    }
    if (this.match('LParen')) {
      const start = this.previous()
      const expr = this.parseDef()
      const close = this.consume('RParen', 'Expected ")" after expression')
      expr.span = spanBetween(start.span, close.span)
      return expr
    }
    if (this.match('LBracket')) {
      return this.parseArray(this.previous())
    }
    if (this.match('LBrace')) {
      return this.parseObject(this.previous())
    }
    if (this.match('Reduce')) return this.parseReduce(this.previous())
    if (this.match('Foreach')) return this.parseForeach(this.previous())
    if (this.match('Try')) return this.parseTry(this.previous())
    if (this.match('DotDot')) return { kind: 'Recurse', span: this.previous().span }
    if (this.match('DotDot')) return { kind: 'Recurse', span: this.previous().span }
    if (this.match('Break')) return this.parseBreak(this.previous())
    throw this.error(this.peek(), 'Unexpected token')
  }

  // Moved ParseLabel to ParseBinding level

  private parseBreak(start: Token): FilterNode {
    const varToken = this.consume('Variable', 'Expected variable after "break"')
    return {
      kind: 'Break',
      label: String(varToken.value),
      span: spanBetween(start.span, varToken.span),
    }
  }

  private parseReduce(start: Token): ReduceNode {
    const source = this.parsePipe()
    this.consume('As', 'Expected "as" after reduce source')
    const varToken = this.consume('Variable', 'Expected variable after "as"')
    this.consume('LParen', 'Expected "(" after variable')
    const init = this.parseComma()
    this.consume('Semicolon', 'Expected ";" after init')
    const update = this.parseComma()
    const end = this.consume('RParen', 'Expected ")" after update')
    return {
      kind: 'Reduce',
      source,
      var: String(varToken.value),
      init,
      update,
      span: spanBetween(start.span, end.span),
    }
  }

  private parseForeach(start: Token): ForeachNode {
    const source = this.parsePipe()
    this.consume('As', 'Expected "as" after foreach source')
    const varToken = this.consume('Variable', 'Expected variable after "as"')
    this.consume('LParen', 'Expected "(" after variable')
    const init = this.parseComma()
    this.consume('Semicolon', 'Expected ";" after init')
    const update = this.parseComma()
    let extract: FilterNode | undefined
    if (this.match('Semicolon')) {
      extract = this.parseComma()
    }
    const end = this.consume('RParen', 'Expected ")" after foreach body')
    return {
      kind: 'Foreach',
      source,
      var: String(varToken.value),
      init,
      update,
      extract,
      span: spanBetween(start.span, end.span),
    }
  }

  private parseTry(start: Token): TryNode {
    const body = this.parseDef(true)
    let handler: FilterNode | undefined
    let endSpan = body.span
    if (this.match('Catch')) {
      handler = this.parseDef(true)
      endSpan = handler.span
    }
    return {
      kind: 'Try',
      body,
      handler,
      span: spanBetween(start.span, endSpan),
    }
  }

  private parseIf(start: Token): FilterNode {
    const branches: { cond: FilterNode; then: FilterNode }[] = []
    const firstCond = this.parseDef(true)
    this.consume('Then', 'Expected "then" after condition')
    const firstThen = this.parseDef(true)
    branches.push({ cond: firstCond, then: firstThen })

    while (this.match('Elif')) {
      const cond = this.parseDef(true)
      this.consume('Then', 'Expected "then" after elif condition')
      const thenBranch = this.parseDef(true)
      branches.push({ cond, then: thenBranch })
    }

    this.consume('Else', 'Expected "else" in if expression')
    const elseBranch = this.parseDef(true)
    const endToken = this.consume('End', 'Expected "end" to close if expression')
    return {
      kind: 'If',
      branches,
      else: elseBranch,
      span: spanBetween(start.span, endToken.span),
    }
  }

  private parseArray(start: Token): ArrayNode {
    const items: FilterNode[] = []
    if (!this.match('RBracket')) {
      do {
        items.push(this.parseDef(false))
      } while (this.match('Comma'))
      this.consume('RBracket', 'Expected "]" after array elements')
    }
    return {
      kind: 'Array',
      items,
      span: spanBetween(start.span, this.previous().span),
    }
  }

  private parseObject(start: Token): ObjectNode {
    const entries: ObjectEntry[] = []
    if (!this.match('RBrace')) {
      do {
        const key = this.parseObjectKey()
        let value: FilterNode
        if (this.match('Colon')) {
          value = this.parseDef(false)
        } else {
          // Shorthand syntax: { id } -> { id: .id }
          if (key.kind === 'KeyIdentifier') {
            value = {
              kind: 'FieldAccess',
              target: { kind: 'Identity', span: key.span },
              field: key.name,
              span: key.span,
            }
          } else if (key.kind === 'KeyString') {
            value = {
              kind: 'FieldAccess',
              target: { kind: 'Identity', span: key.span },
              field: key.value,
              span: key.span,
            }
          } else {
            throw this.error(this.peek(), 'Expected ":" after object key')
          }
        }
        entries.push({ key, value })
      } while (this.match('Comma'))
      this.consume('RBrace', 'Expected "}" after object entries')
    }
    return {
      kind: 'Object',
      entries,
      span: spanBetween(start.span, this.previous().span),
    }
  }

  private parseObjectEntry(): ObjectEntry {
    const key = this.parseObjectKey()
    this.consume('Colon', 'Expected ":" after object key')
    const value = this.parseDef(false)
    return { key, value }
  }

  private parseObjectKey(): ObjectKey {
    if (this.match('Identifier')) {
      const token = this.previous()
      return {
        kind: 'KeyIdentifier',
        name: String(token.value),
        span: token.span,
      }
    }
    if (this.match('String')) {
      const token = this.previous()
      return {
        kind: 'KeyString',
        value: String(token.value),
        span: token.span,
      }
    }
    if (this.match('LParen')) {
      const start = this.previous()
      const expr = this.parseComma()
      const closing = this.consume('RParen', 'Expected ")" after computed key expression')
      return {
        kind: 'KeyExpr',
        expr,
        span: spanBetween(start.span, closing.span),
      }
    }
    throw this.error(this.peek(), 'Expected identifier, string, or "(expr)" as object key')
  }

  private finishFieldAccess(target: FilterNode): FilterNode {
    if (this.match('Identifier')) {
      const token = this.previous()
      return {
        kind: 'FieldAccess',
        target,
        field: String(token.value),
        span: spanBetween(target.span, token.span),
      }
    }
    if (this.match('String')) {
      const token = this.previous()
      return {
        kind: 'FieldAccess',
        target,
        field: String(token.value),
        span: spanBetween(target.span, token.span),
      }
    }
    throw this.error(this.peek(), 'Expected field name after "."')
  }

  private parseLeadingDot(dot: Token): FilterNode {
    let expr: FilterNode = { kind: 'Identity', span: dot.span }
    while (true) {
      if (this.check('Identifier') || this.check('String')) {
        expr = this.finishFieldAccess(expr)
        continue
      }
      if (this.match('LBracket')) {
        // Check for [:end]
        if (this.match('Colon')) {
          let end: FilterNode | null = null
          if (!this.check('RBracket')) {
            end = this.parsePipe()
          }
          const close = this.consume('RBracket', 'Expected "]" after slice')
          expr = {
            kind: 'Slice',
            target: expr,
            start: null,
            end,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        if (this.match('RBracket')) {
          const close = this.previous()
          expr = {
            kind: 'Iterate',
            target: expr,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        const index = this.parsePipe()

        if (this.match('Colon')) {
          let end: FilterNode | null = null
          if (!this.check('RBracket')) {
            end = this.parsePipe()
          }
          const close = this.consume('RBracket', 'Expected "]" after slice')
          expr = {
            kind: 'Slice',
            target: expr,
            start: index,
            end,
            span: spanBetween(expr.span, close.span),
          }
          continue
        }

        const closing = this.consume('RBracket', 'Expected "]" after index expression')
        expr = {
          kind: 'IndexAccess',
          target: expr,
          index,
          span: spanBetween(expr.span, closing.span),
        }
        continue
      }
      if (this.match('Question')) {
        const op = this.previous()
        expr = {
          kind: 'Try',
          body: expr,
          handler: { kind: 'Identity', span: op.span } as FilterNode,
          span: spanBetween(expr.span, op.span),
        }
        continue
      }
      break
    }
    return expr
  }

  private finishIdentifier(token: Token): FilterNode {
    if (this.match('LParen')) {
      const args = this.parseCallArguments()
      const closing = this.consume('RParen', 'Expected ")" after arguments')
      return {
        kind: 'Call',
        name: String(token.value),
        args,
        span: spanBetween(token.span, closing.span),
      }
    }
    return {
      kind: 'Call',
      name: String(token.value),
      args: [],
      span: token.span,
    }
  }

  private parseCallArguments(): FilterNode[] {
    const args: FilterNode[] = []
    if (this.check('RParen')) {
      return args
    }
    do {
      args.push(this.parseDef(true))
    } while (this.match('Semicolon'))
    return args
  }

  private literalNode(value: LiteralValue, span: Span): FilterNode {
    return { kind: 'Literal', value, span }
  }

  private makeBinary(left: FilterNode, right: FilterNode, op: BinaryOp): FilterNode {
    return {
      kind: 'Binary',
      op,
      left,
      right,
      span: spanBetween(left.span, right.span),
    }
  }

  private parseStringInterpolation(start: Token): FilterNode {
    const parts: FilterNode[] = [{ kind: 'Literal', value: String(start.value), span: start.span }]

    while (true) {
      // Parse expression
      const expr = this.parseDef()
      parts.push({
        kind: 'Pipe',
        left: expr,
        right: {
          kind: 'Call',
          name: 'tostring',
          args: [],
          span: expr.span,
        },
        span: expr.span,
      })

      if (this.match('StringMiddle')) {
        const token = this.previous()
        parts.push({ kind: 'Literal', value: String(token.value), span: token.span })
        continue
      }
      if (this.match('StringEnd')) {
        const token = this.previous()
        parts.push({ kind: 'Literal', value: String(token.value), span: token.span })
        break
      }
      throw this.error(this.peek(), 'Expected closing paren of interpolation or continuation')
    }

    return parts.reduce((acc, curr) => ({
      kind: 'Binary',
      op: '+', // Use + operator which handles concatenation
      left: acc,
      right: curr,
      span: spanBetween(acc.span, curr.span),
    }))
  }

  private match(kind: TokenKind): boolean {
    if (this.check(kind)) {
      this.advance()
      return true
    }
    return false
  }

  private consume(kind: TokenKind, message: string): Token {
    if (this.check(kind)) return this.advance()
    throw this.error(this.peek(), message)
  }

  private check(kind: TokenKind): boolean {
    if (this.isAtEnd()) return kind === 'EOF'
    return this.peek().kind === kind
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current += 1
    return this.previous()
  }

  private isAtEnd(): boolean {
    return this.peek().kind === 'EOF'
  }

  private peek(): Token {
    return this.tokens[this.current] ?? { kind: 'EOF', span: { start: 0, end: 0 } }
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? { kind: 'EOF', span: { start: 0, end: 0 } }
  }

  private error(token: Token, message: string): ParseError {
    return new ParseError(message, token.span)
  }
}

const spanBetween = (a: Span, b: Span): Span => ({
  start: Math.min(a.start, b.start),
  end: Math.max(a.end, b.end),
})
