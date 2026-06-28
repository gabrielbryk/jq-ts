import type { Span } from '../../span'
import { fieldsFromEpoch, type TimeFields } from './fields'
import { handleLiteral, handleSpec } from './handlers'
import { utcMillis } from './millis'
import { type ParseState, Scanner } from './scanner'

/** Parses a string into broken-down time fields using a C `strptime`-style format. */
export const parseStrptime = (input: string, fmt: string, span: Span): TimeFields => {
  const sc = new Scanner(input, fmt, span)
  const st: ParseState = { year: 1900, mon: 0, mday: 1, hour: 0, min: 0, sec: 0 }

  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== '%') {
      handleLiteral(fmt[i]!, sc)
      continue
    }
    i++
    handleSpec(fmt[i], sc, st)
  }

  // Normalize to UTC, then re-derive wday/yday from the calendar date.
  const utcMs = utcMillis(st.year, st.mon, st.mday, st.hour, st.min, st.sec)
  return fieldsFromEpoch(utcMs / 1000, true)
}
