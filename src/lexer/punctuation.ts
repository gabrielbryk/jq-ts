import { LexError } from '../errors'
import { isIdentifierPart, isIdentifierStart } from './char-classes'
import { advance, makeSpan, peek, pushToken, type Scanner } from './scanner'

const scanDot = (s: Scanner, start: number): void => {
  advance(s)
  if (peek(s) === '.') {
    advance(s)
    pushToken(s, 'DotDot', start, s.pos)
  } else {
    pushToken(s, 'Dot', start, s.pos)
  }
}

const scanSlash = (s: Scanner, start: number): void => {
  advance(s)
  if (peek(s) === '/') {
    advance(s)
    if (peek(s) === '=') {
      advance(s)
      pushToken(s, 'AltEq', start, s.pos)
    } else {
      pushToken(s, 'Alt', start, s.pos)
    }
  } else if (peek(s) === '=') {
    advance(s)
    pushToken(s, 'SlashEq', start, s.pos)
  } else {
    pushToken(s, 'Slash', start, s.pos)
  }
}

const scanBang = (s: Scanner, start: number): void => {
  advance(s)
  if (peek(s) === '=') {
    advance(s)
    pushToken(s, 'BangEqual', start, s.pos)
  } else {
    throw new LexError('Unexpected "!" (only "!=" supported)', makeSpan(start, s.pos))
  }
}

const scanVariable = (s: Scanner, start: number): void => {
  advance(s)
  if (!isIdentifierStart(peek(s))) {
    throw new LexError('Expected identifier after "$"', makeSpan(start, s.pos))
  }
  const nameStart = s.pos
  while (isIdentifierPart(peek(s))) advance(s)
  pushToken(s, 'Variable', start, s.pos, s.text.slice(nameStart, s.pos))
}

/** Characters whose tokens need bespoke multi-character lookahead. */
export const multiChar: Record<string, (s: Scanner, start: number) => void> = {
  '.': scanDot,
  '/': scanSlash,
  '!': scanBang,
  $: scanVariable,
}
