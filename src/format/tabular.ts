import { stableStringify } from '../builtins/utils'
import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, type Value } from '../value'
import { numberString } from './coerce'

const rowError = (cell: Value, span: Span): RuntimeError =>
  new RuntimeError(
    `${describeType(cell)} (${stableStringify(cell)}) is not valid in a csv row`,
    span
  )

const requireArray = (value: Value, kind: 'csv' | 'tsv', span: Span): Value[] => {
  if (!Array.isArray(value)) {
    throw new RuntimeError(
      `${describeType(value)} (${stableStringify(value)}) cannot be ${kind}-formatted, only array`,
      span
    )
  }
  return value
}

/** Quotes a CSV cell: doubling embedded `"`, per jq's `@csv`. */
const csvCell = (cell: Value, span: Span): string => {
  if (cell === null) return ''
  if (typeof cell === 'boolean') return cell ? 'true' : 'false'
  if (typeof cell === 'number') return numberString(cell)
  if (typeof cell === 'string') return `"${cell.replace(/"/g, '""')}"`
  throw rowError(cell, span)
}

/** Escapes a TSV cell: backslash first, then tab/newline/CR, per jq's `@tsv`. */
const tsvCell = (cell: Value, span: Span): string => {
  if (cell === null) return ''
  if (typeof cell === 'boolean') return cell ? 'true' : 'false'
  if (typeof cell === 'number') return numberString(cell)
  if (typeof cell === 'string') {
    return cell
      .replace(/\\/g, '\\\\')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
  }
  throw rowError(cell, span)
}

/** Formats an array as a comma-separated row (`@csv`). */
export const csvFormat = (value: Value, span: Span): string =>
  requireArray(value, 'csv', span)
    .map((cell) => csvCell(cell, span))
    .join(',')

/** Formats an array as a tab-separated row (`@tsv`). */
export const tsvFormat = (value: Value, span: Span): string =>
  requireArray(value, 'tsv', span)
    .map((cell) => tsvCell(cell, span))
    .join('\t')
