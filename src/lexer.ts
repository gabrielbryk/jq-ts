import { LexError } from './errors'
import { scanFormat } from './lexer/format'
import { scanIdentifier } from './lexer/identifiers'
import { scanNumber } from './lexer/number'
import { scanOperator } from './lexer/operators'
import { createScanner, makeSpan, peek, pushToken } from './lexer/scanner'
import { scanInterpolationResume, scanString } from './lexer/string-tokens'
import { skipTrivia } from './lexer/trivia'
import type { Token } from './tokens'

/**
 * Tokenizes the input jq string into a list of AST tokens.
 * Handles string interpolation, comments, and operator grouping.
 *
 * @param text - The source code to tokenize.
 * @returns An array of {@link Token}, including an EOF token at the end.
 * @throws {@link LexError} if an invalid character or sequence is encountered.
 */
export const lex = (text: string): Token[] => {
  const s = createScanner(text)

  while (s.pos < s.length) {
    if (skipTrivia(s)) continue

    const start = s.pos

    // Check if we are ending an interpolation before treating ')' as RParen.
    if (scanInterpolationResume(s, start)) continue
    if (scanString(s, start)) continue
    if (scanOperator(s, start)) continue
    if (scanNumber(s, start)) continue
    if (scanIdentifier(s, start)) continue
    if (scanFormat(s, start)) continue

    const ch = peek(s)
    throw new LexError(`Unexpected character "${ch}"`, makeSpan(start, start + 1))
  }

  pushToken(s, 'EOF', s.pos, s.pos)
  return s.tokens
}
