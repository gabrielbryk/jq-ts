import type { TokenKind } from '../tokens'
import { multiChar } from './punctuation'
import { advance, peek, pushToken, type Scanner } from './scanner'

/** Punctuation that always maps to a single fixed token. */
const singleChar: Record<string, TokenKind> = {
  ';': 'Semicolon',
  ',': 'Comma',
  '?': 'Question',
  '(': 'LParen',
  ')': 'RParen',
  '[': 'LBracket',
  ']': 'RBracket',
  '{': 'LBrace',
  '}': 'RBrace',
  ':': 'Colon',
}

/** Operators of the form `x` / `x=`, mapped to `[plain, withEquals]`. */
const eqSuffix: Record<string, [TokenKind, TokenKind]> = {
  '|': ['Pipe', 'BarEq'],
  '+': ['Plus', 'PlusEq'],
  '-': ['Minus', 'MinusEq'],
  '*': ['Star', 'StarEq'],
  '%': ['Percent', 'PercentEq'],
  '=': ['Eq', 'EqualEqual'],
  '<': ['Less', 'LessEqual'],
  '>': ['Greater', 'GreaterEqual'],
}

const scanEqSuffix = (s: Scanner, start: number, pair: [TokenKind, TokenKind]): void => {
  advance(s)
  if (peek(s) === '=') {
    advance(s)
    pushToken(s, pair[1], start, s.pos)
  } else {
    pushToken(s, pair[0], start, s.pos)
  }
}

/**
 * Scans operator and punctuation tokens. Returns whether the current
 * character was recognized and consumed.
 */
export const scanOperator = (s: Scanner, start: number): boolean => {
  const ch = peek(s)
  if (ch === undefined) return false

  const special = multiChar[ch]
  if (special) {
    special(s, start)
    return true
  }

  const single = singleChar[ch]
  if (single) {
    advance(s)
    pushToken(s, single, start, s.pos)
    return true
  }

  const pair = eqSuffix[ch]
  if (pair) {
    scanEqSuffix(s, start, pair)
    return true
  }

  return false
}
