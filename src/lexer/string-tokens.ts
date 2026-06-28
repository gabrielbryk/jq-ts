import { advance, peek, pushToken, type Scanner } from './scanner'
import { readString, readStringValue } from './strings'

/**
 * Handles a `"`-introduced string token (`String` or `StringStart` when the
 * literal opens an interpolation). Returns whether a token was produced.
 */
export const scanString = (s: Scanner, start: number): boolean => {
  if (peek(s) !== '"') return false

  const endPos = readString(s, start, true)
  const isInterp = s.text.substring(endPos - 2, endPos) === '\\('
  const value = readStringValue(s, start, start + 1, endPos - (isInterp ? 2 : 1))

  if (isInterp) {
    s.modeStack.push(1)
    pushToken(s, 'StringStart', start, endPos, value)
  } else {
    pushToken(s, 'String', start, endPos, value)
  }
  return true
}

/**
 * Resumes a string literal after an interpolation `)` closes, emitting either
 * `StringMiddle` (another `\(` follows) or `StringEnd`. Returns whether the
 * `)` was consumed as an interpolation boundary.
 */
export const scanInterpolationResume = (s: Scanner, start: number): boolean => {
  if (peek(s) !== ')' || s.modeStack.length <= 1) return false

  advance(s) // consume ')'
  const endPos = readString(s, start, false) // false = not initial quote
  const value = readStringValue(s, start, start + 1, endPos - (peek(s, -1) === '"' ? 1 : 2))

  if (s.text[endPos - 1] === '"') {
    s.modeStack.pop()
    pushToken(s, 'StringEnd', start, endPos, value)
  } else {
    pushToken(s, 'StringMiddle', start, endPos, value)
  }
  return true
}
