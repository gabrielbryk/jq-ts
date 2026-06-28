import type { Span } from '../span'
import type { Token, TokenKind } from '../tokens'

/**
 * Mutable lexer state shared across the scanning helpers.
 *
 * `pos` advances as characters are consumed; `tokens` accumulates the output;
 * `modeStack` tracks string-interpolation nesting (only the depth is read).
 */
export interface Scanner {
  readonly text: string
  readonly length: number
  pos: number
  readonly tokens: Token[]
  readonly modeStack: number[]
}

export const createScanner = (text: string): Scanner => ({
  text,
  length: text.length,
  pos: 0,
  tokens: [],
  modeStack: [0],
})

export const peek = (s: Scanner, offset = 0): string | undefined => s.text[s.pos + offset]

export const advance = (s: Scanner): string | undefined => s.text[s.pos++]

export const makeSpan = (start: number, end: number): Span => ({ start, end })

export const pushToken = (
  s: Scanner,
  kind: TokenKind,
  start: number,
  end: number,
  value?: string | number
): void => {
  s.tokens.push({ kind, span: makeSpan(start, end), value })
}
