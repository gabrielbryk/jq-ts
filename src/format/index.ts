import { stableStringify } from '../builtins/utils'
import { RuntimeError } from '../errors'
import type { Span } from '../span'
import type { Value } from '../value'
import { base32Decode, base32Encode } from './base32'
import { base64Decode, base64Encode } from './base64'
import { utf8Decode, utf8Encode } from './bytes'
import { toFormatString } from './coerce'
import { shFormat } from './shell'
import { csvFormat, tsvFormat } from './tabular'
import { htmlEscape } from './text'
import { uriEncode } from './uri'

/** Encodes a value with a named `@`-format. */
type Formatter = (value: Value, span: Span) => string

const formatters: Record<string, Formatter> = {
  text: (value) => toFormatString(value),
  json: (value) => stableStringify(value),
  html: (value) => htmlEscape(toFormatString(value)),
  uri: (value) => uriEncode(toFormatString(value)),
  sh: (value, span) => shFormat(value, span),
  csv: (value, span) => csvFormat(value, span),
  tsv: (value, span) => tsvFormat(value, span),
  base64: (value) => base64Encode(utf8Encode(toFormatString(value))),
  base64d: (value, span) => utf8Decode(base64Decode(toFormatString(value), span)),
  base32: (value) => base32Encode(utf8Encode(toFormatString(value))),
  base32d: (value, span) => utf8Decode(base32Decode(toFormatString(value), span)),
}

/** Whether `name` is a recognized `@`-format. */
export const isFormatName = (name: string): boolean => Object.hasOwn(formatters, name)

/**
 * Applies the `@<name>` encoder to `value`, returning the encoded string.
 *
 * @throws {RuntimeError} If the format name is unknown or the value cannot be
 *   encoded by that format (e.g. `@csv` on a non-array).
 */
export const applyFormat = (name: string, value: Value, span: Span): string => {
  const formatter = formatters[name]
  if (!formatter) {
    throw new RuntimeError(`${name} is not a valid format`, span)
  }
  return formatter(value, span)
}
