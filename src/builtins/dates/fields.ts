import { RuntimeError } from '../../errors'
import type { Span } from '../../span'
import type { Value } from '../../value'
import { localMillis, utcMillis, yearDay } from './millis'

/**
 * Broken-down time fields and the conversions between epoch seconds, jq's
 * 8-element arrays, and these fields. See the package barrel for the wire
 * format jq uses. Low-level millisecond math lives in ./millis and the type
 * guards in ./guards.
 */
export interface TimeFields {
  year: number
  mon: number
  mday: number
  hour: number
  min: number
  sec: number
  wday: number
  yday: number
}

/** Converts epoch seconds into broken-down time fields (UTC or local). */
export const fieldsFromEpoch = (epochSeconds: number, utc: boolean): TimeFields => {
  const whole = Math.floor(epochSeconds)
  const frac = epochSeconds - whole
  const d = new Date(whole * 1000)
  const year = utc ? d.getUTCFullYear() : d.getFullYear()
  const mon = utc ? d.getUTCMonth() : d.getMonth()
  const mday = utc ? d.getUTCDate() : d.getDate()
  const hour = utc ? d.getUTCHours() : d.getHours()
  const min = utc ? d.getUTCMinutes() : d.getMinutes()
  const sec = utc ? d.getUTCSeconds() : d.getSeconds()
  const wday = utc ? d.getUTCDay() : d.getDay()
  return { year, mon, mday, hour, min, sec: sec + frac, wday, yday: yearDay(year, mon, mday) }
}

export const fieldsToArray = (f: TimeFields): number[] => [
  f.year,
  f.mon,
  f.mday,
  f.hour,
  f.min,
  f.sec,
  f.wday,
  f.yday,
]

/**
 * Parses a jq broken-down time array into fields. Missing trailing slots
 * default to 0 (jq is lenient: `[1,2,3] | mktime` works); present-but-non-number
 * slots are an error. wday/yday are derived from the calendar date when absent.
 */
export const fieldsFromArray = (input: Value, fn: string, span: Span): TimeFields => {
  if (!Array.isArray(input)) {
    throw new RuntimeError(`${fn} requires array inputs`, span)
  }
  const at = (index: number): number => {
    if (index >= input.length) return 0
    const raw = input[index]
    if (typeof raw !== 'number') {
      throw new RuntimeError(`${fn} requires an array of numbers`, span)
    }
    return raw
  }
  const year = at(0)
  const mon = at(1)
  const mday = at(2)
  const hour = at(3)
  const min = at(4)
  const sec = at(5)
  const wday =
    input.length > 6 && typeof input[6] === 'number'
      ? input[6]
      : new Date(utcMillis(year, mon, mday)).getUTCDay()
  const yday =
    input.length > 7 && typeof input[7] === 'number' ? input[7] : yearDay(year, mon, mday)
  return { year, mon, mday, hour, min, sec, wday, yday }
}

/** Converts broken-down time fields back into epoch seconds (mktime). */
export const epochFromFields = (f: TimeFields, utc: boolean): number => {
  const wholeSec = Math.floor(f.sec)
  const frac = f.sec - wholeSec
  const ms = utc
    ? utcMillis(f.year, f.mon, f.mday, f.hour, f.min, wholeSec)
    : localMillis(f.year, f.mon, f.mday, f.hour, f.min, wholeSec)
  return ms / 1000 + frac
}

/** Resolves strftime input that may be either an epoch number or a broken-down array. */
export const fieldsForFormat = (input: Value, fn: string, span: Span, utc: boolean): TimeFields =>
  typeof input === 'number' ? fieldsFromEpoch(input, utc) : fieldsFromArray(input, fn, span)
