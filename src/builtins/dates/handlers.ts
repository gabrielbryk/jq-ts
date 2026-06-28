import { MONTH_ABBR, MONTH_FULL, WEEKDAY_ABBR, WEEKDAY_FULL } from './constants'
import { handleNumeric } from './handlers-numeric'
import type { ParseState, Scanner } from './scanner'

/** Reads an AM/PM marker and promotes/demotes the hour, as glibc's %p does. */
const applyMeridiem = (sc: Scanner, st: ParseState): void => {
  const ampm = sc.input.slice(sc.s, sc.s + 2).toUpperCase()
  if (ampm === 'AM') {
    if (st.hour === 12) st.hour = 0
    sc.s += 2
  } else if (ampm === 'PM') {
    if (st.hour < 12) st.hour += 12
    sc.s += 2
  } else {
    sc.fail()
  }
}

/**
 * Consumes a `%z` offset. jq consumes the timezone offset but does not shift
 * the wall-clock fields by it — the broken-down array has no tz slot, so e.g.
 * "23:51:47+05:30" yields the literal 23:51:47, same as jq.
 */
const consumeOffset = (sc: Scanner): void => {
  if (sc.input[sc.s] === 'Z') {
    sc.s++
    return
  }
  if (sc.input[sc.s] === '+' || sc.input[sc.s] === '-') sc.s++
  sc.s += 2 // hours
  if (sc.input[sc.s] === ':') sc.s++
  sc.s += 2 // minutes
}

/** Name/timezone/literal specifiers handled after the numeric group. */
const handleSymbolic = (spec: string | undefined, sc: Scanner, st: ParseState): void => {
  switch (spec) {
    case 'b':
    case 'B':
    case 'h':
      st.mon = sc.matchName([...MONTH_ABBR, ...MONTH_FULL]) % 12
      break
    case 'a':
    case 'A':
      sc.matchName([...WEEKDAY_ABBR, ...WEEKDAY_FULL]) // consumed, recomputed later
      break
    case 'p':
    case 'P':
      applyMeridiem(sc, st)
      break
    case 'z':
      consumeOffset(sc)
      break
    case 'Z':
      while (sc.s < sc.input.length && /[A-Za-z]/.test(sc.input[sc.s]!)) sc.s++
      break
    case 'n':
    case 't':
      sc.skipWhitespace()
      break
    case '%':
      if (sc.input[sc.s] !== '%') sc.fail()
      sc.s++
      break
    default:
      sc.fail()
  }
}

/** Dispatches a single `%`-specifier, mutating the scan state in place. */
export const handleSpec = (spec: string | undefined, sc: Scanner, st: ParseState): void => {
  if (spec !== undefined && handleNumeric(spec, sc, st)) return
  handleSymbolic(spec, sc, st)
}

/** Consumes a literal (non-`%`) format character against the input. */
export const handleLiteral = (ch: string, sc: Scanner): void => {
  if (/\s/.test(ch)) {
    sc.skipWhitespace()
  } else {
    if (sc.input[sc.s] !== ch) sc.fail()
    sc.s++
  }
}
