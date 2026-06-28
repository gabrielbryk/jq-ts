import { RuntimeError } from '../errors'
import type { Span } from '../span'
import { describeType, type Value } from '../value'
import type { BuiltinSpec } from './types'
import { emit } from './utils'

/**
 * Date/time builtins matching the jq binary (jq 1.7+/1.8).
 *
 * jq represents time in two forms:
 *   - a number of seconds since the Unix epoch (possibly fractional), and
 *   - a "broken down time": an 8-element array
 *       [ year, month(0-11), mday, hour, minute, second,
 *         weekday(0-6, Sun=0), yearday(0-365) ].
 *     The second slot carries the fractional part of the input, and `year` is
 *     the full year (NOT year-1900). This mirrors `1425599507 | gmtime ==
 *     [2015,2,5,23,51,47,4,63]`.
 *
 * `now` is the only clock-dependent builtin; it reads the instant injected via
 * `options.now` and throws when none was supplied (jq-ts never reads the host
 * clock on its own). Every other builtin here is a pure function of its input.
 *
 * Known deviation: `strftime`'s `%s` specifier is computed as the UTC epoch of
 * the broken-down time, whereas glibc's `%s` uses the host timezone. jq-ts
 * favors determinism/portability here; every other specifier matches jq.
 */

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MS_PER_DAY = 86_400_000

/**
 * `Date.UTC` / `new Date(y, …)` map years 0–99 to 1900–1999 (a legacy JS
 * quirk). jq uses the literal year, so these helpers correct it via
 * `setUTCFullYear` / `setFullYear`, which accept the true year.
 */
const utcMillis = (year: number, mon: number, mday: number, hour = 0, min = 0, sec = 0): number => {
  const ms = Date.UTC(year, mon, mday, hour, min, sec)
  if (year >= 0 && year <= 99) {
    const d = new Date(ms)
    d.setUTCFullYear(year)
    return d.getTime()
  }
  return ms
}

const localMillis = (
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

interface TimeFields {
  year: number
  mon: number
  mday: number
  hour: number
  min: number
  sec: number
  wday: number
  yday: number
}

const pad = (value: number, width: number, fill = '0'): string =>
  String(Math.trunc(value)).padStart(width, fill)

const requireNumber = (input: Value, fn: string, span: Span): number => {
  if (typeof input !== 'number') {
    throw new RuntimeError(`${fn}() requires numeric inputs`, span)
  }
  return input
}

const requireString = (input: Value, fn: string, span: Span): string => {
  if (typeof input !== 'string') {
    throw new RuntimeError(`${fn} requires a string, got ${describeType(input)}`, span)
  }
  return input
}

/** Day-of-year (0-based), computed with date-only UTC math so DST can't skew it. */
const yearDay = (year: number, mon: number, mday: number): number =>
  Math.round((utcMillis(year, mon, mday) - utcMillis(year, 0, 1)) / MS_PER_DAY)

/** Converts epoch seconds into broken-down time fields (UTC or local). */
const fieldsFromEpoch = (epochSeconds: number, utc: boolean): TimeFields => {
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

const fieldsToArray = (f: TimeFields): number[] => [
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
const fieldsFromArray = (input: Value, fn: string, span: Span): TimeFields => {
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
const epochFromFields = (f: TimeFields, utc: boolean): number => {
  const wholeSec = Math.floor(f.sec)
  const frac = f.sec - wholeSec
  const ms = utc
    ? utcMillis(f.year, f.mon, f.mday, f.hour, f.min, wholeSec)
    : localMillis(f.year, f.mon, f.mday, f.hour, f.min, wholeSec)
  return ms / 1000 + frac
}

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

/** Formats broken-down time with a C `strftime`-style format. */
const formatStrftime = (f: TimeFields, fmt: string, utc: boolean): string => {
  const hour12 = f.hour % 12 === 0 ? 12 : f.hour % 12
  let out = ''
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== '%') {
      out += fmt[i]
      continue
    }
    i++
    const spec = fmt[i]
    switch (spec) {
      case 'Y':
        out += String(f.year)
        break
      case 'C':
        out += pad(Math.floor(f.year / 100), 2)
        break
      case 'y':
        out += pad(((f.year % 100) + 100) % 100, 2)
        break
      case 'm':
        out += pad(f.mon + 1, 2)
        break
      case 'd':
        out += pad(f.mday, 2)
        break
      case 'e':
        out += pad(f.mday, 2, ' ')
        break
      case 'H':
        out += pad(f.hour, 2)
        break
      case 'k':
        out += pad(f.hour, 2, ' ')
        break
      case 'I':
        out += pad(hour12, 2)
        break
      case 'l':
        out += pad(hour12, 2, ' ')
        break
      case 'M':
        out += pad(f.min, 2)
        break
      case 'S':
        out += pad(Math.floor(f.sec), 2)
        break
      case 'p':
        out += f.hour < 12 ? 'AM' : 'PM'
        break
      case 'P':
        out += f.hour < 12 ? 'am' : 'pm'
        break
      case 'j':
        out += pad(f.yday + 1, 3)
        break
      case 'a':
        out += WEEKDAY_ABBR[((f.wday % 7) + 7) % 7]
        break
      case 'A':
        out += WEEKDAY_FULL[((f.wday % 7) + 7) % 7]
        break
      case 'b':
      case 'h':
        out += MONTH_ABBR[((f.mon % 12) + 12) % 12]
        break
      case 'B':
        out += MONTH_FULL[((f.mon % 12) + 12) % 12]
        break
      case 'u':
        out += String(f.wday === 0 ? 7 : f.wday)
        break
      case 'w':
        out += String(f.wday)
        break
      case 'V':
        out += pad(isoWeek(f.year, f.mon, f.mday).week, 2)
        break
      case 'G':
        out += String(isoWeek(f.year, f.mon, f.mday).year)
        break
      case 'Z':
        out += utc ? 'GMT' : localTzAbbr(f)
        break
      case 'z':
        out += utc ? '+0000' : localOffsetString(f)
        break
      case 's':
        // Deterministic UTC epoch (see file header note on the glibc deviation).
        out += String(Math.floor(epochFromFields(f, true)))
        break
      case 'T':
        out += `${pad(f.hour, 2)}:${pad(f.min, 2)}:${pad(Math.floor(f.sec), 2)}`
        break
      case 'R':
        out += `${pad(f.hour, 2)}:${pad(f.min, 2)}`
        break
      case 'F':
        out += `${String(f.year)}-${pad(f.mon + 1, 2)}-${pad(f.mday, 2)}`
        break
      case 'D':
        out += `${pad(f.mon + 1, 2)}/${pad(f.mday, 2)}/${pad(((f.year % 100) + 100) % 100, 2)}`
        break
      case 'n':
        out += '\n'
        break
      case 't':
        out += '\t'
        break
      case '%':
        out += '%'
        break
      case undefined:
        out += '%'
        break
      default:
        out += `%${spec}`
        break
    }
  }
  return out
}

/** Parses a string into broken-down time fields using a C `strptime`-style format. */
const parseStrptime = (input: string, fmt: string, span: Span): TimeFields => {
  let s = 0
  let year = 1900
  let mon = 0
  let mday = 1
  let hour = 0
  let min = 0
  let sec = 0

  const fail = (): never => {
    throw new RuntimeError(`date "${input}" does not match format "${fmt}"`, span)
  }
  const readInt = (maxLen: number): number => {
    const start = s
    if (input[s] === '+' || input[s] === '-') s++
    let digits = 0
    while (s < input.length && digits < maxLen && /[0-9]/.test(input[s]!)) {
      s++
      digits++
    }
    if (digits === 0) fail()
    return parseInt(input.slice(start, s), 10)
  }
  const matchName = (names: readonly string[]): number => {
    const lower = input.slice(s).toLowerCase()
    let best = -1
    let bestLen = 0
    names.forEach((name, index) => {
      const n = name.toLowerCase()
      if (lower.startsWith(n) && n.length > bestLen) {
        best = index
        bestLen = n.length
      }
    })
    if (best < 0) fail()
    s += bestLen
    return best
  }

  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== '%') {
      if (/\s/.test(fmt[i]!)) {
        while (s < input.length && /\s/.test(input[s]!)) s++
      } else {
        if (input[s] !== fmt[i]) fail()
        s++
      }
      continue
    }
    i++
    const spec = fmt[i]
    switch (spec) {
      case 'Y':
        year = readInt(4)
        break
      case 'y': {
        const yy = readInt(2)
        year = yy < 69 ? 2000 + yy : 1900 + yy
        break
      }
      case 'C':
        year = readInt(2) * 100
        break
      case 'm':
        mon = readInt(2) - 1
        break
      case 'd':
      case 'e':
        while (s < input.length && input[s] === ' ') s++
        mday = readInt(2)
        break
      case 'H':
      case 'k':
      case 'I':
      case 'l':
        // %I/%l are 12-hour; %p (if present) promotes the afternoon hours.
        while (s < input.length && input[s] === ' ') s++
        hour = readInt(2)
        break
      case 'M':
        min = readInt(2)
        break
      case 'S':
        sec = readInt(2)
        break
      case 'j':
        readInt(3) // day-of-year consumed; calendar date drives the result
        break
      case 'b':
      case 'B':
      case 'h':
        mon = matchName([...MONTH_ABBR, ...MONTH_FULL]) % 12
        break
      case 'a':
      case 'A':
        matchName([...WEEKDAY_ABBR, ...WEEKDAY_FULL]) // consumed, recomputed below
        break
      case 'p':
      case 'P': {
        const ampm = input.slice(s, s + 2).toUpperCase()
        if (ampm === 'AM') {
          if (hour === 12) hour = 0
          s += 2
        } else if (ampm === 'PM') {
          if (hour < 12) hour += 12
          s += 2
        } else {
          fail()
        }
        break
      }
      case 'z':
        // jq consumes the timezone offset but does not shift the wall-clock
        // fields by it — the broken-down array has no tz slot, so e.g.
        // "23:51:47+05:30" yields the literal 23:51:47, same as jq.
        if (input[s] === 'Z') {
          s++
        } else {
          if (input[s] === '+' || input[s] === '-') s++
          s += 2 // hours
          if (input[s] === ':') s++
          s += 2 // minutes
        }
        break
      case 'Z':
        while (s < input.length && /[A-Za-z]/.test(input[s]!)) s++
        break
      case 'n':
      case 't':
        while (s < input.length && /\s/.test(input[s]!)) s++
        break
      case '%':
        if (input[s] !== '%') fail()
        s++
        break
      default:
        fail()
    }
  }

  // Normalize to UTC, then re-derive wday/yday from the calendar date.
  const utcMs = utcMillis(year, mon, mday, hour, min, sec)
  return fieldsFromEpoch(utcMs / 1000, true)
}

/** Resolves strftime input that may be either an epoch number or a broken-down array. */
const fieldsForFormat = (input: Value, fn: string, span: Span, utc: boolean): TimeFields =>
  typeof input === 'number' ? fieldsFromEpoch(input, utc) : fieldsFromArray(input, fn, span)

const readFormat = (value: Value, fn: string, span: Span): string => {
  if (typeof value !== 'string') {
    throw new RuntimeError(`${fn}/1 requires a string format`, span)
  }
  return value
}

const ISO8601 = '%Y-%m-%dT%H:%M:%SZ'

export const dateBuiltins: BuiltinSpec[] = [
  {
    name: 'now',
    arity: 0,
    apply: function* (_input, _args, _env, tracker, _eval, span) {
      yield emit(tracker.clock.now(span), span, tracker)
    },
  },
  {
    name: 'gmtime',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(
        fieldsToArray(fieldsFromEpoch(requireNumber(input, 'gmtime', span), true)),
        span,
        tracker
      )
    },
  },
  {
    name: 'localtime',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(
        fieldsToArray(fieldsFromEpoch(requireNumber(input, 'localtime', span), false)),
        span,
        tracker
      )
    },
  },
  {
    name: 'mktime',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      yield emit(epochFromFields(fieldsFromArray(input, 'mktime', span), true), span, tracker)
    },
  },
  {
    name: 'strftime',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const fields = fieldsForFormat(input, 'strftime', span, true)
      for (const fmt of evaluate(args[0]!, input, env, tracker)) {
        yield emit(formatStrftime(fields, readFormat(fmt, 'strftime', span), true), span, tracker)
      }
    },
  },
  {
    name: 'strflocaltime',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const fields = fieldsForFormat(input, 'strflocaltime', span, false)
      for (const fmt of evaluate(args[0]!, input, env, tracker)) {
        yield emit(
          formatStrftime(fields, readFormat(fmt, 'strflocaltime', span), false),
          span,
          tracker
        )
      }
    },
  },
  {
    name: 'strptime',
    arity: 1,
    apply: function* (input, args, env, tracker, evaluate, span) {
      const str = requireString(input, 'strptime', span)
      for (const fmt of evaluate(args[0]!, input, env, tracker)) {
        yield emit(
          fieldsToArray(parseStrptime(str, readFormat(fmt, 'strptime', span), span)),
          span,
          tracker
        )
      }
    },
  },
  {
    name: 'todate',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      const fields = fieldsFromEpoch(requireNumber(input, 'todate', span), true)
      yield emit(formatStrftime(fields, ISO8601, true), span, tracker)
    },
  },
  {
    name: 'todateiso8601',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      const fields = fieldsFromEpoch(requireNumber(input, 'todateiso8601', span), true)
      yield emit(formatStrftime(fields, ISO8601, true), span, tracker)
    },
  },
  {
    name: 'fromdate',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      const fields = parseStrptime(requireString(input, 'fromdate', span), ISO8601, span)
      yield emit(epochFromFields(fields, true), span, tracker)
    },
  },
  {
    name: 'fromdateiso8601',
    arity: 0,
    apply: function* (input, _args, _env, tracker, _eval, span) {
      const fields = parseStrptime(requireString(input, 'fromdateiso8601', span), ISO8601, span)
      yield emit(epochFromFields(fields, true), span, tracker)
    },
  },
]
