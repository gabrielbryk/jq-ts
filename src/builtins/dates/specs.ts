import { MONTH_ABBR, MONTH_FULL, MS_PER_DAY, WEEKDAY_ABBR, WEEKDAY_FULL } from './constants'
import { epochFromFields, type TimeFields } from './fields'
import { localMillis, pad, utcMillis } from './millis'

/** ISO-8601 week-numbering year and week (for %G / %V). */
const isoWeek = (year: number, mon: number, mday: number): { year: number; week: number } => {
  const date = new Date(utcMillis(year, mon, mday))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // nearest Thursday
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(utcMillis(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY))
  return { year: isoYear, week }
}

const localOffsetString = (f: TimeFields): string => {
  const offsetMin = -new Date(
    localMillis(f.year, f.mon, f.mday, f.hour, f.min, Math.floor(f.sec))
  ).getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return `${sign}${pad(Math.floor(abs / 60), 2)}${pad(abs % 60, 2)}`
}

/** Best-effort local timezone abbreviation via Intl, falling back to the offset. */
const localTzAbbr = (f: TimeFields): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
    }).formatToParts(new Date(localMillis(f.year, f.mon, f.mday, f.hour, f.min, Math.floor(f.sec))))
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value
    if (tz) return tz
  } catch {
    // Intl unavailable — fall through to the numeric offset.
  }
  return localOffsetString(f)
}

const idx = (value: number, len: number): number => ((value % len) + len) % len
const yy = (year: number): number => ((year % 100) + 100) % 100

/**
 * A single strftime conversion specifier. `utc` distinguishes %Z/%z output and
 * is otherwise unused by the date-only specifiers.
 */
export type SpecFn = (f: TimeFields, utc: boolean) => string

/** Lookup table for every supported `%` specifier (table-driven dispatch). */
export const SPECS: Record<string, SpecFn> = {
  Y: (f) => String(f.year),
  C: (f) => pad(Math.floor(f.year / 100), 2),
  y: (f) => pad(yy(f.year), 2),
  m: (f) => pad(f.mon + 1, 2),
  d: (f) => pad(f.mday, 2),
  e: (f) => pad(f.mday, 2, ' '),
  H: (f) => pad(f.hour, 2),
  k: (f) => pad(f.hour, 2, ' '),
  I: (f) => pad(f.hour % 12 === 0 ? 12 : f.hour % 12, 2),
  l: (f) => pad(f.hour % 12 === 0 ? 12 : f.hour % 12, 2, ' '),
  M: (f) => pad(f.min, 2),
  S: (f) => pad(Math.floor(f.sec), 2),
  p: (f) => (f.hour < 12 ? 'AM' : 'PM'),
  P: (f) => (f.hour < 12 ? 'am' : 'pm'),
  j: (f) => pad(f.yday + 1, 3),
  a: (f) => WEEKDAY_ABBR[idx(f.wday, 7)]!,
  A: (f) => WEEKDAY_FULL[idx(f.wday, 7)]!,
  b: (f) => MONTH_ABBR[idx(f.mon, 12)]!,
  h: (f) => MONTH_ABBR[idx(f.mon, 12)]!,
  B: (f) => MONTH_FULL[idx(f.mon, 12)]!,
  u: (f) => String(f.wday === 0 ? 7 : f.wday),
  w: (f) => String(f.wday),
  V: (f) => pad(isoWeek(f.year, f.mon, f.mday).week, 2),
  G: (f) => String(isoWeek(f.year, f.mon, f.mday).year),
  Z: (f, utc) => (utc ? 'GMT' : localTzAbbr(f)),
  z: (f, utc) => (utc ? '+0000' : localOffsetString(f)),
  // Deterministic UTC epoch (see file header note on the glibc deviation).
  s: (f) => String(Math.floor(epochFromFields(f, true))),
  T: (f) => `${pad(f.hour, 2)}:${pad(f.min, 2)}:${pad(Math.floor(f.sec), 2)}`,
  R: (f) => `${pad(f.hour, 2)}:${pad(f.min, 2)}`,
  F: (f) => `${String(f.year)}-${pad(f.mon + 1, 2)}-${pad(f.mday, 2)}`,
  D: (f) => `${pad(f.mon + 1, 2)}/${pad(f.mday, 2)}/${pad(yy(f.year), 2)}`,
  n: () => '\n',
  t: () => '\t',
  '%': () => '%',
}
