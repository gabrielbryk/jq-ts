import { keywordKinds } from '../tokens'
import { isIdentifierPart, isIdentifierStart } from './char-classes'
import { advance, peek, pushToken, type Scanner } from './scanner'

/**
 * Emits an identifier or keyword token when the current character begins an
 * identifier. Returns whether a token was produced.
 */
export const scanIdentifier = (s: Scanner, start: number): boolean => {
  if (!isIdentifierStart(peek(s))) return false

  while (isIdentifierPart(peek(s))) advance(s)
  const raw = s.text.slice(start, s.pos)
  const keyword = keywordKinds[raw]
  if (keyword === 'Null' || keyword === 'True' || keyword === 'False') {
    pushToken(s, keyword, start, s.pos)
  } else if (keyword) {
    pushToken(s, keyword, start, s.pos, raw)
  } else {
    pushToken(s, 'Identifier', start, s.pos, raw)
  }
  return true
}
