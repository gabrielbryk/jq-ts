import { RuntimeError } from '../errors'
import type { Span } from '../span'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const DECODE: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) DECODE[ALPHABET[i]!] = i

/** Encodes bytes to standard RFC 4648 base64 with `=` padding (the `@base64` filter). */
export const base64Encode = (bytes: number[]): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += b1 === undefined ? '=' : ALPHABET[(n >> 6) & 63]!
    out += b2 === undefined ? '=' : ALPHABET[n & 63]!
  }
  return out
}

/**
 * Decodes standard base64 to bytes (the `@base64d` filter). Padding is optional;
 * invalid characters and a stray trailing character are rejected, matching jq.
 */
export const base64Decode = (str: string, span: Span): number[] => {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  let count = 0
  for (const ch of str) {
    if (ch === '=') break
    const v = DECODE[ch]
    if (v === undefined) {
      throw new RuntimeError(`string ("${str}") is not valid base64 data`, span)
    }
    count++
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  if (count % 4 === 1) {
    throw new RuntimeError(`string ("${str}") trailing base64 byte found`, span)
  }
  return bytes
}
