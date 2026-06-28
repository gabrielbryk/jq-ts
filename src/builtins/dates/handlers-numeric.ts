import type { ParseState, Scanner } from './scanner'

/** Numeric (`readInt`-backed) specifiers; returns false when `spec` isn't one. */
export const handleNumeric = (spec: string, sc: Scanner, st: ParseState): boolean => {
  switch (spec) {
    case 'Y':
      st.year = sc.readInt(4)
      return true
    case 'y': {
      const v = sc.readInt(2)
      st.year = v < 69 ? 2000 + v : 1900 + v
      return true
    }
    case 'C':
      st.year = sc.readInt(2) * 100
      return true
    case 'm':
      st.mon = sc.readInt(2) - 1
      return true
    case 'd':
    case 'e':
      sc.skipSpaces()
      st.mday = sc.readInt(2)
      return true
    case 'H':
    case 'k':
    case 'I':
    case 'l':
      // %I/%l are 12-hour; %p (if present) promotes the afternoon hours.
      sc.skipSpaces()
      st.hour = sc.readInt(2)
      return true
    case 'M':
      st.min = sc.readInt(2)
      return true
    case 'S':
      st.sec = sc.readInt(2)
      return true
    case 'j':
      sc.readInt(3) // day-of-year consumed; calendar date drives the result
      return true
    default:
      return false
  }
}
