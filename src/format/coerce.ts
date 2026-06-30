import { stableStringify } from '../builtins/utils'
import type { Value } from '../value'

/**
 * Coerces a value to the string jq's text-oriented formats operate on: strings
 * pass through unchanged, everything else is rendered as JSON. This matches
 * jq's `tostring` for non-strings (jq-ts sorts object keys, the documented
 * deviation for `@json`).
 */
export const toFormatString = (value: Value): string =>
  typeof value === 'string' ? value : stableStringify(value)

/** Renders a number cell the way jq prints it inside `@csv`/`@tsv`/`@sh`. */
export const numberString = (value: number): string => stableStringify(value)
