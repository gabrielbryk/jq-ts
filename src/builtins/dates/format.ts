import type { TimeFields } from './fields'
import { SPECS } from './specs'

/** Renders one `%`-escape; mirrors jq's fallbacks for trailing/unknown specs. */
const renderSpec = (spec: string | undefined, f: TimeFields, utc: boolean): string => {
  if (spec === undefined) return '%'
  const fn = SPECS[spec]
  return fn ? fn(f, utc) : `%${spec}`
}

/** Formats broken-down time with a C `strftime`-style format. */
export const formatStrftime = (f: TimeFields, fmt: string, utc: boolean): string => {
  let out = ''
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== '%') {
      out += fmt[i]
      continue
    }
    i++
    out += renderSpec(fmt[i], f, utc)
  }
  return out
}
