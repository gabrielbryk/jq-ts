import { RuntimeError } from '../errors'
import type { Span } from '../span'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const DECODE: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET[i]!] = i

/** Encodes bytes to RFC 4648 base32 with `=` padding (the `@base32` filter). */
export const base32Encode = (bytes: number[]): string => {
  let out = ''
  let buffer = 0
  let bits = 0
  for (const b of bytes) {
    buffer = (buffer << 8) | b
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += ALPHABET[(buffer >> bits) & 31]!
    }
  }
  if (bits > 0) {
    out += ALPHABET[(buffer << (5 - bits)) & 31]!
  }
  while (out.length % 8 !== 0) out += '='
  return out
}

/**
 * Decodes RFC 4648 base32 to bytes (the `@base32d` filter). Padding is optional;
 * invalid characters are rejected.
 */
export const base32Decode = (str: string, span: Span): number[] => {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const ch of str) {
    if (ch === '=') break
    const v = DECODE[ch]
    if (v === undefined) {
      throw new RuntimeError(`string ("${str}") is not valid base32 data`, span)
    }
    buffer = (buffer << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return bytes
}
