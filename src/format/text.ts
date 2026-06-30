/** HTML/shell text encoders for the `@html` and `@sh` (scalar) formats. */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&apos;',
  '"': '&quot;',
}

/** Escapes `& < > ' "` per jq's `@html`. The character class is linear (no ReDoS). */
export const htmlEscape = (str: string): string =>
  str.replace(/[&<>'"]/g, (ch) => HTML_ESCAPES[ch]!)

/**
 * Single-quotes a string for POSIX shells per jq's `@sh`, turning each embedded
 * `'` into the `'\''` sequence. The replacement is linear (no ReDoS).
 */
export const shellQuote = (str: string): string => `'${str.replace(/'/g, "'\\''")}'`
