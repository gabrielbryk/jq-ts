/**
 * Pure, isolate-safe UTF-8 helpers used by the byte-oriented `@`-format
 * encoders (`@base64`, `@base32`, `@uri`). Implemented over codepoints/bytes
 * by hand so they do not depend on Node's `Buffer`, `TextEncoder`, or the
 * `btoa`/`atob` globals.
 */

/** Encodes a JS string to its UTF-8 byte sequence (one entry per byte, 0-255). */
export const utf8Encode = (str: string): number[] => {
  const bytes: number[] = []
  for (const ch of str) {
    const cp = ch.codePointAt(0)!
    if (cp <= 0x7f) {
      bytes.push(cp)
    } else if (cp <= 0x7ff) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp <= 0xffff) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      )
    }
  }
  return bytes
}

/** Continuation-byte count implied by a UTF-8 lead byte (0 for an invalid lead). */
const leadLength = (b: number): number => {
  if (b >= 0xf0) return 3
  if (b >= 0xe0) return 2
  if (b >= 0xc0) return 1
  return 0
}

/** Initial codepoint bits carried by a UTF-8 lead byte. */
const leadBits = (b: number, n: number): number => {
  if (n === 3) return b & 0x07
  if (n === 2) return b & 0x0f
  if (n === 1) return b & 0x1f
  return b
}

/**
 * Decodes a UTF-8 byte sequence back to a JS string. Lenient: malformed
 * sequences are passed through best-effort rather than throwing, so callers can
 * round-trip arbitrary `@base64d`/`@base32d` payloads.
 */
export const utf8Decode = (bytes: number[]): string => {
  let result = ''
  let i = 0
  while (i < bytes.length) {
    const lead = bytes[i++]!
    const n = leadLength(lead)
    let cp = leadBits(lead, n)
    for (let k = 0; k < n; k++) {
      const cont = bytes[i]
      if (cont === undefined || (cont & 0xc0) !== 0x80) break
      cp = (cp << 6) | (cont & 0x3f)
      i++
    }
    result += String.fromCodePoint(cp)
  }
  return result
}
