import { MS_PER_DAY } from './constants'

/**
 * Low-level epoch-millisecond helpers shared by the field conversions and the
 * formatters. These isolate JS's year 0–99 quirk so callers never see it.
 */

export const pad = (value: number, width: number, fill = '0'): string =>
  String(Math.trunc(value)).padStart(width, fill)

/**
 * `Date.UTC` / `new Date(y, …)` map years 0–99 to 1900–1999 (a legacy JS
 * quirk). jq uses the literal year, so these helpers correct it via
 * `setUTCFullYear` / `setFullYear`, which accept the true year.
 */
export const utcMillis = (
  year: number,
  mon: number,
  mday: number,
  hour = 0,
  min = 0,
  sec = 0
): number => {
  const ms = Date.UTC(year, mon, mday, hour, min, sec)
  if (year >= 0 && year <= 99) {
    const d = new Date(ms)
    d.setUTCFullYear(year)
    return d.getTime()
  }
  return ms
}

export const localMillis = (
  year: number,
  mon: number,
  mday: number,
  hour = 0,
  min = 0,
  sec = 0
): number => {
  const d = new Date(year, mon, mday, hour, min, sec)
  if (year >= 0 && year <= 99) d.setFullYear(year)
  return d.getTime()
}

/** Day-of-year (0-based), computed with date-only UTC math so DST can't skew it. */
export const yearDay = (year: number, mon: number, mday: number): number =>
  Math.round((utcMillis(year, mon, mday) - utcMillis(year, 0, 1)) / MS_PER_DAY)
