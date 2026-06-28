export const isWhitespace = (ch: string | undefined): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'

export const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9'

export const isIdentifierStart = (ch: string | undefined): boolean =>
  !!ch && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_')

export const isIdentifierPart = (ch: string | undefined): boolean =>
  isIdentifierStart(ch) || isDigit(ch)

export const isHexDigit = (ch: string | undefined): boolean =>
  !!ch && ((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F'))
