import type { FilterNode, FormatNode } from '../ast'
import type { Token } from '../tokens'
import { buildInterpolation, type InterpWrap } from './calls'
import type { ParserState } from './state'
import { spanBetween } from './state'

/**
 * Wraps an interpolated value so it is piped through the `@<name>` encoder.
 * Literal segments of the string are left unformatted (jq semantics).
 */
const formatWrap =
  (name: string): InterpWrap =>
  (expr) => ({
    kind: 'Pipe',
    left: expr,
    right: { kind: 'Format', name, span: expr.span },
    span: expr.span,
  })

/**
 * Parses an `@<name>` format reference. Bare (`@base64`) it applies the encoder
 * to the input value. Followed by a string (`@base64 "x=\(.x)"`) the encoder is
 * applied to each interpolated value while literal text passes through.
 */
export function parseFormat(p: ParserState, token: Token): FilterNode {
  const name = String(token.value)

  if (p.check('StringStart')) {
    const startTok = p.advance()
    const str = buildInterpolation(p, startTok, formatWrap(name))
    return formatNode(name, str, spanBetween(token.span, str.span))
  }

  if (p.check('String')) {
    const strTok = p.advance()
    const str: FilterNode = { kind: 'Literal', value: String(strTok.value), span: strTok.span }
    return formatNode(name, str, spanBetween(token.span, strTok.span))
  }

  return { kind: 'Format', name, span: token.span }
}

const formatNode = (name: string, str: FilterNode, span: FormatNode['span']): FormatNode => ({
  kind: 'Format',
  name,
  str,
  span,
})
