import { LexError } from './errors'
import type { Span } from './span'
import type { Token, TokenKind } from './tokens'
import { keywordKinds } from './tokens'

/**
 * Tokenizes the input jq string into a list of AST tokens.
 * Handles string interpolation, comments, and operator grouping.
 *
 * @param text - The source code to tokenize.
 * @returns An array of {@link Token}, including an EOF token at the end.
 * @throws {@link LexError} if an invalid character or sequence is encountered.
 */
export const lex = (text: string): Token[] => {
  const tokens: Token[] = []
  const length = text.length
  let pos = 0

  const peek = (offset = 0) => text[pos + offset]
  const advance = () => text[pos++]
  const makeSpan = (start: number, end: number): Span => ({ start, end })
  const pushToken = (kind: TokenKind, start: number, end: number, value?: string | number) => {
    tokens.push({ kind, span: makeSpan(start, end), value })
  }

  const isWhitespace = (ch: string | undefined) =>
    ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
  const isDigit = (ch: string | undefined) => !!ch && ch >= '0' && ch <= '9'
  const isIdentifierStart = (ch: string | undefined) =>
    !!ch && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_')
  const isIdentifierPart = (ch: string | undefined) => isIdentifierStart(ch) || isDigit(ch)

  // Modes: 0=Normal, 1=Interpolation
  const modeStack: number[] = [0]

  while (pos < length) {
    // Check for interpolation end ')' if in String mode (actually it's handled by ) case)
    const ch = peek()

    // ... whitespace, comments ...
    if (isWhitespace(ch)) {
      advance()
      continue
    }
    if (ch === '#') {
      while (pos < length && peek() !== '\n') advance()
      continue
    }

    const start = pos

    if (ch === ')') {
      // Check if we are ending an interpolation
      if (modeStack.length > 1) {
        advance() // consume ')'
        // Resume string
        const endPos = readString(start, false) // false = not initial quote
        const value = readStringValue(start, start + 1, endPos - (peek(-1) === '"' ? 1 : 2))
        // Check how readString ended
        if (text[endPos - 1] === '"') {
          // Ended with quote
          modeStack.pop()
          pushToken('StringEnd', start, endPos, value)
        } else {
          // Ended with \(
          pushToken('StringMiddle', start, endPos, value)
        }
        continue
      }
      // Else normal RParen
    }

    switch (ch) {
      case '"': {
        const endPos = readString(start, true)
        const isInterp = text.substring(endPos - 2, endPos) === '\\('
        const value = readStringValue(start, start + 1, endPos - (isInterp ? 2 : 1))

        if (isInterp) {
          modeStack.push(1)
          pushToken('StringStart', start, endPos, value)
        } else {
          pushToken('String', start, endPos, value)
        }
        continue
      }
      // ... same cases ...
      case '.': {
        advance()
        if (peek() === '.') {
          advance()
          pushToken('DotDot', start, pos)
        } else {
          pushToken('Dot', start, pos)
        }
        continue
      }
      case ';': {
        advance()
        pushToken('Semicolon', start, pos)
        continue
      }
      case ',': {
        advance()
        pushToken('Comma', start, pos)
        continue
      }
      case '?': {
        advance()
        pushToken('Question', start, pos)
        continue
      }
      case '|': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('BarEq', start, pos)
        } else {
          pushToken('Pipe', start, pos)
        }
        continue
      }
      case '/': {
        advance()
        if (peek() === '/') {
          advance()
          if (peek() === '=') {
            advance()
            pushToken('AltEq', start, pos)
          } else {
            pushToken('Alt', start, pos)
          }
        } else if (peek() === '=') {
          advance()
          pushToken('SlashEq', start, pos)
        } else {
          pushToken('Slash', start, pos)
        }
        continue
      }
      case '(': {
        advance()
        pushToken('LParen', start, pos)
        continue
      }
      case ')': {
        advance()
        pushToken('RParen', start, pos)
        continue
      }
      case '[': {
        advance()
        pushToken('LBracket', start, pos)
        continue
      }
      case ']': {
        advance()
        pushToken('RBracket', start, pos)
        continue
      }
      case '{': {
        advance()
        pushToken('LBrace', start, pos)
        continue
      }
      case '}': {
        advance()
        pushToken('RBrace', start, pos)
        continue
      }
      case ':': {
        advance()
        pushToken('Colon', start, pos)
        continue
      }
      case '+': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('PlusEq', start, pos)
        } else {
          pushToken('Plus', start, pos)
        }
        continue
      }
      case '-': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('MinusEq', start, pos)
        } else {
          pushToken('Minus', start, pos)
        }
        continue
      }
      case '*': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('StarEq', start, pos)
        } else {
          pushToken('Star', start, pos)
        }
        continue
      }
      case '%': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('PercentEq', start, pos)
        } else {
          pushToken('Percent', start, pos)
        }
        continue
      }
      case '=': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('EqualEqual', start, pos)
        } else {
          pushToken('Eq', start, pos)
        }
        continue
      }
      case '!': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('BangEqual', start, pos)
        } else {
          throw new LexError('Unexpected "!" (only "!=" supported)', makeSpan(start, pos))
        }
        continue
      }
      case '<': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('LessEqual', start, pos)
        } else {
          pushToken('Less', start, pos)
        }
        continue
      }
      case '>': {
        advance()
        if (peek() === '=') {
          advance()
          pushToken('GreaterEqual', start, pos)
        } else {
          pushToken('Greater', start, pos)
        }
        continue
      }
      case '$': {
        advance()
        if (!isIdentifierStart(peek())) {
          throw new LexError('Expected identifier after "$"', makeSpan(start, pos))
        }
        const nameStart = pos
        while (isIdentifierPart(peek())) advance()
        pushToken('Variable', start, pos, text.slice(nameStart, pos))
        continue
      }
      default:
        break
    }

    if (isDigit(ch)) {
      const end = readNumber(start)
      const raw = text.slice(start, end)
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        throw new LexError(`Invalid number literal: ${raw}`, makeSpan(start, end))
      }
      pushToken('Number', start, end, value)
      continue
    }

    if (isIdentifierStart(ch)) {
      while (isIdentifierPart(peek())) advance()
      const raw = text.slice(start, pos)
      const keyword = keywordKinds[raw]
      // ...
      if (keyword === 'Null' || keyword === 'True' || keyword === 'False') {
        pushToken(keyword, start, pos)
      } else if (keyword) {
        pushToken(keyword, start, pos)
      } else {
        pushToken('Identifier', start, pos, raw)
      }
      continue
    }

    throw new LexError(`Unexpected character "${ch}"`, makeSpan(start, start + 1))
  }

  pushToken('EOF', pos, pos)
  return tokens

  function readNumber(tokenStart: number): number {
    while (isDigit(peek())) advance()
    if (peek() === '.' && isDigit(peek(1))) {
      advance()
      while (isDigit(peek())) advance()
    }
    if (peek() === 'e' || peek() === 'E') {
      advance()
      if (peek() === '+' || peek() === '-') advance()
      if (!isDigit(peek())) {
        throw new LexError(`Invalid exponent in number literal`, makeSpan(tokenStart, pos))
      }
      while (isDigit(peek())) advance()
    }
    return pos
  }

  function readString(tokenStart: number, openQuote: boolean): number {
    if (openQuote) advance() // consume opening "

    while (pos < length) {
      const current = advance()
      if (current === '"') {
        return pos
      }
      if (current === '\\') {
        if (peek() === '(') {
          advance() // consum (
          return pos
        }
        // Escape handling
        const esc = advance()
        if (!esc) break
        // ... (standard escapes)
        if ('"\\/bfnrt'.includes(esc)) continue
        if (esc === 'u') {
          for (let i = 0; i < 4; i++) {
            const h = advance()
            if (!h || !isHexDigit(h))
              throw new LexError('Invalid Unicode escape', makeSpan(tokenStart, pos))
          }
          continue
        }
        throw new LexError(`Invalid escape sequence "\\${esc}"`, makeSpan(tokenStart, pos))
      }
    }
    throw new LexError('Unterminated string literal', makeSpan(tokenStart, pos))
  }

  function readStringValue(tokenStart: number, innerStart: number, innerEnd: number): string {
    let result = ''
    let i = innerStart
    while (i < innerEnd) {
      const ch = text[i]
      if (ch === '\\') {
        const next = text[i + 1]
        if (!next) throw new LexError('Unexpected end of input', makeSpan(tokenStart, pos))

        if ('"\\/bfnrt'.includes(next)) {
          switch (next) {
            case '"':
              result += '"'
              break
            case '\\':
              result += '\\'
              break
            case '/':
              result += '/'
              break
            case 'b':
              result += '\b'
              break
            case 'f':
              result += '\f'
              break
            case 'n':
              result += '\n'
              break
            case 'r':
              result += '\r'
              break
            case 't':
              result += '\t'
              break
          }
          i += 2
          continue
        }
        if (next === 'u') {
          const hex = text.slice(i + 2, i + 6)
          result += String.fromCharCode(parseInt(hex, 16))
          i += 6
          continue
        }
        throw new LexError(`Invalid escape sequence "\\${next}"`, makeSpan(tokenStart, pos))
      } else {
        result += ch
        i += 1
      }
    }
    return result
  }
}

const isHexDigit = (ch: string | undefined) =>
  !!ch && ((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F'))
