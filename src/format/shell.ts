import { stableStringify } from '../builtins/utils'
import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, type Value } from '../value'
import { numberString } from './coerce'
import { shellQuote } from './text'

/** Renders a single shell token; arrays/objects cannot be shell-escaped. */
const shCell = (cell: Value, span: Span): string => {
  if (cell === null) return 'null'
  if (typeof cell === 'boolean') return cell ? 'true' : 'false'
  if (typeof cell === 'number') return numberString(cell)
  if (typeof cell === 'string') return shellQuote(cell)
  throw new RuntimeError(
    `${describeType(cell)} (${stableStringify(cell)}) can not be escaped for shell`,
    span
  )
}

/**
 * Formats a value for the shell per jq's `@sh`. An array becomes its elements
 * joined by spaces; any other value is shell-escaped directly.
 */
export const shFormat = (value: Value, span: Span): string => {
  if (Array.isArray(value)) {
    return value.map((cell) => shCell(cell, span)).join(' ')
  }
  return shCell(value, span)
}
