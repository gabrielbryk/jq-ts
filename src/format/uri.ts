import { utf8Encode } from './bytes'

/** RFC 3986 unreserved bytes that jq's `@uri` leaves untouched: A-Z a-z 0-9 - _ . ~ */
const isUnreserved = (b: number): boolean =>
  (b >= 0x41 && b <= 0x5a) ||
  (b >= 0x61 && b <= 0x7a) ||
  (b >= 0x30 && b <= 0x39) ||
  b === 0x2d ||
  b === 0x5f ||
  b === 0x2e ||
  b === 0x7e

const HEX = '0123456789ABCDEF'

/** Percent-encodes a string per jq's `@uri` (UTF-8 bytes, uppercase hex). */
export const uriEncode = (str: string): string => {
  let out = ''
  for (const b of utf8Encode(str)) {
    if (isUnreserved(b)) {
      out += String.fromCharCode(b)
    } else {
      out += `%${HEX[(b >> 4) & 0xf]!}${HEX[b & 0xf]!}`
    }
  }
  return out
}
