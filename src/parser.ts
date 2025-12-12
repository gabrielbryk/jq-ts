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
    const expr = this.parseBinding()
    this.consume('EOF', 'Expected end of expression')
    return expr
  }

  private parseBinding(): FilterNode {
    let expr = this.parseComma()
    while (this.match('As')) {
      const varToken = this.consume('Variable', 'Expected variable name after "as"')
      this.consume('Pipe', 'Expected "|" after variable binding')
      const body = this.parseBinding()
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

  private parseComma(): FilterNode {
    let expr = this.parsePipe()
    while (this.match('Comma')) {
      const right = this.parsePipe()
      expr = {
        kind: 'Comma',
        left: expr,
        right,
        span: spanBetween(expr.span, right.span),
      }
    }
    return expr
  }

  private parsePipe(): FilterNode {
    let expr = this.parsePipeOperand()
    while (this.match('Pipe')) {
      const right = this.parsePipeOperand()
      expr = {
        kind: 'Pipe',
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
        const closing = this.consume('RBracket', 'Expected "]" after index expression')
        expr = {
          kind: 'IndexAccess',
          target: expr,
          index,
          span: spanBetween(expr.span, closing.span),
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
      const expr = this.parseComma()
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
    throw this.error(this.peek(), 'Unexpected token')
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
    const body = this.parseComma()
    let handler: FilterNode | undefined
    let endSpan = body.span
    if (this.match('Catch')) {
      handler = this.parseComma()
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
    const firstCond = this.parsePipe()
    this.consume('Then', 'Expected "then" after condition')
    const firstThen = this.parsePipe()
    branches.push({ cond: firstCond, then: firstThen })

    while (this.match('Elif')) {
      const cond = this.parsePipe()
      this.consume('Then', 'Expected "then" after elif condition')
      const thenBranch = this.parsePipe()
      branches.push({ cond, then: thenBranch })
    }

    this.consume('Else', 'Expected "else" in if expression')
    const elseBranch = this.parsePipe()
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
    if (!this.check('RBracket')) {
      do {
        items.push(this.parsePipe())
      } while (this.match('Comma'))
    }
    const end = this.consume('RBracket', 'Expected "]" after array literal')
    return {
      kind: 'Array',
      items,
      span: spanBetween(start.span, end.span),
    }
  }

  private parseObject(start: Token): ObjectNode {
    const entries: ObjectEntry[] = []
    if (!this.check('RBrace')) {
      do {
        entries.push(this.parseObjectEntry())
      } while (this.match('Comma'))
    }
    const end = this.consume('RBrace', 'Expected "}" after object literal')
    return {
      kind: 'Object',
      entries,
      span: spanBetween(start.span, end.span),
    }
  }

  private parseObjectEntry(): ObjectEntry {
    const key = this.parseObjectKey()
    this.consume('Colon', 'Expected ":" after object key')
    const value = this.parsePipe()
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
        const closing = this.consume('RBracket', 'Expected "]" after index expression')
        expr = {
          kind: 'IndexAccess',
          target: expr,
          index,
          span: spanBetween(expr.span, closing.span),
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
      args.push(this.parsePipe())
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
