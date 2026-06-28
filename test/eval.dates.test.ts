import { describe, expect, it } from 'vitest'

import { type EvalOptions, runAst } from '../src/eval'
import { parse } from '../src/parser'
import { validate } from '../src/validate'
import type { Value } from '../src/value'

const evalExpr = (expr: string, input: Value = null, options: EvalOptions = {}) => {
  const ast = parse(expr)
  validate(ast)
  return runAst(ast, input, options)
}

const one = (expr: string, input: Value = null, options: EvalOptions = {}): Value => {
  const out = evalExpr(expr, input, options)
  expect(out).toHaveLength(1)
  return out[0]!
}

// Reference instant: 2015-03-05T23:51:47Z == epoch 1425599507.
// jq's broken-down time layout: [year, month(0-11), mday, hour, min, sec, wday, yday].
const EPOCH = 1425599507
const BROKEN_DOWN = [2015, 2, 5, 23, 51, 47, 4, 63]

/** Locally-computed expected broken-down array (matches the impl's local-tz wiring). */
const localExpected = (epoch: number): number[] => {
  const d = new Date(epoch * 1000)
  const year = d.getFullYear()
  const mon = d.getMonth()
  const mday = d.getDate()
  const yday = Math.round((Date.UTC(year, mon, mday) - Date.UTC(year, 0, 1)) / 86_400_000)
  return [year, mon, mday, d.getHours(), d.getMinutes(), d.getSeconds(), d.getDay(), yday]
}

describe('date builtins', () => {
  describe('gmtime', () => {
    it('breaks an epoch into jq’s struct-tm array (UTC)', () => {
      expect(one('gmtime', EPOCH)).toEqual(BROKEN_DOWN)
    })

    it('handles the epoch origin', () => {
      expect(one('gmtime', 0)).toEqual([1970, 0, 1, 0, 0, 0, 4, 0])
    })

    it('handles negative (pre-1970) epochs', () => {
      // 1969-12-31T23:59:59Z
      expect(one('gmtime', -1)).toEqual([1969, 11, 31, 23, 59, 59, 3, 364])
    })

    it('handles a far-future epoch', () => {
      // 2100-01-01T00:00:00Z (not a leap year)
      expect(one('gmtime', 4102444800)).toEqual([2100, 0, 1, 0, 0, 0, 5, 0])
    })

    it('handles a leap day', () => {
      // 2020-02-29T12:00:00Z
      expect(one('gmtime', 1582977600)).toEqual([2020, 1, 29, 12, 0, 0, 6, 59])
    })

    it('preserves fractional seconds in the seconds slot', () => {
      const result = one('gmtime', EPOCH + 0.25) as number[]
      expect(result[5]).toBeCloseTo(47.25, 6)
    })

    it.each([
      ['string', '"x"'],
      ['null', 'null'],
      ['array', '[1]'],
      ['object', '{}'],
      ['boolean', 'true'],
    ])('rejects %s input', (_label, lit) => {
      expect(() => evalExpr(`${lit} | gmtime`)).toThrow(/requires numeric inputs/)
    })
  })

  describe('localtime', () => {
    it('breaks an epoch into a local-time array (layout/wiring)', () => {
      expect(one('localtime', EPOCH)).toEqual(localExpected(EPOCH))
      expect(one('localtime', 0)).toEqual(localExpected(0))
    })

    it('differs from gmtime only by a whole number of minutes', () => {
      // mktime always reads its array as UTC, so localtime|mktime is shifted
      // from gmtime|mktime by exactly the host timezone offset (whole minutes).
      const gEpoch = one('gmtime | mktime', EPOCH) as number
      const lEpoch = one('localtime | mktime', EPOCH) as number
      expect(Math.abs((lEpoch - gEpoch) % 60)).toBe(0)
    })

    it('requires a number', () => {
      expect(() => evalExpr('localtime', '"x"')).toThrow(/requires numeric inputs/)
    })
  })

  describe('mktime', () => {
    it('is the inverse of gmtime', () => {
      expect(one('mktime', BROKEN_DOWN)).toBe(EPOCH)
      expect(one('gmtime | mktime', EPOCH)).toBe(EPOCH)
    })

    it.each([0, -1, 4102444800, 1582977600, 1735689599])(
      'round-trips gmtime|mktime for epoch %i',
      (epoch) => {
        expect(one('gmtime | mktime', epoch)).toBe(epoch)
      }
    )

    it('is lenient about short arrays (missing slots default to 0)', () => {
      // [year=1,mon=2,mday=3] -> 0001-03-03T00:00:00Z. jq uses the literal year
      // (not the JS 1900-1999 two-digit-year quirk).
      expect(one('mktime', [1, 2, 3])).toBe(-62130326400)
    })

    it('preserves fractional seconds', () => {
      expect(one('mktime', [2015, 2, 5, 23, 51, 47.5, 4, 63])).toBeCloseTo(EPOCH + 0.5, 6)
    })

    it('rejects non-array input', () => {
      expect(() => evalExpr('mktime', '"x"')).toThrow(/requires array inputs/)
    })

    it('rejects a non-number array element', () => {
      expect(() => evalExpr('mktime', [2015, 'x', 5])).toThrow(/requires an array of numbers/)
    })
  })

  describe('strftime — individual specifiers', () => {
    const fmt = (spec: string, arr: number[] = BROKEN_DOWN) =>
      one(`strftime(${JSON.stringify(spec)})`, arr)

    it.each<[string, string]>([
      ['%Y', '2015'],
      ['%C', '20'],
      ['%y', '15'],
      ['%m', '03'],
      ['%d', '05'],
      ['%e', ' 5'],
      ['%H', '23'],
      ['%k', '23'],
      ['%I', '11'],
      ['%l', '11'],
      ['%M', '51'],
      ['%S', '47'],
      ['%p', 'PM'],
      ['%P', 'pm'],
      ['%j', '064'],
      ['%a', 'Thu'],
      ['%A', 'Thursday'],
      ['%b', 'Mar'],
      ['%h', 'Mar'],
      ['%B', 'March'],
      ['%u', '4'],
      ['%w', '4'],
      ['%Z', 'GMT'],
      ['%z', '+0000'],
      ['%T', '23:51:47'],
      ['%R', '23:51'],
      ['%F', '2015-03-05'],
      ['%D', '03/05/15'],
      ['%%', '%'],
    ])('%s -> %s', (spec, expected) => {
      expect(fmt(spec)).toBe(expected)
    })

    it('escape specifiers %n and %t', () => {
      expect(fmt('%n')).toBe('\n')
      expect(fmt('%t')).toBe('\t')
    })

    it('passes unknown specifiers through verbatim', () => {
      expect(fmt('%Q')).toBe('%Q')
    })

    it('space-pads single-digit %e / %l / %k', () => {
      // 2015-01-01T09:05:03Z
      const arr = [2015, 0, 1, 9, 5, 3, 4, 0]
      expect(one('strftime("[%e] [%l] [%k]")', arr)).toBe('[ 1] [ 9] [ 9]')
    })

    it('renders midnight and noon in 12-hour form', () => {
      expect(one('strftime("%I %p")', [2015, 0, 1, 0, 0, 0, 4, 0])).toBe('12 AM')
      expect(one('strftime("%I %p")', [2015, 0, 1, 12, 0, 0, 4, 0])).toBe('12 PM')
    })

    it('day-of-year on a leap-year Dec 31 is 366', () => {
      expect(one('strftime("%j")', [2020, 11, 31, 0, 0, 0, 4, 365])).toBe('366')
    })

    it('%u maps Sunday to 7 while %w maps it to 0', () => {
      // 2015-03-08 is a Sunday.
      const sun = one('gmtime', 1425772800) as number[]
      expect(one('strftime("%u %w %a")', sun)).toBe('7 0 Sun')
    })

    it.each<[string, number, string]>([
      ['2016-01-01 -> prev ISO year wk53', 1451606400, '2015-W53'],
      ['2017-01-01 -> prev ISO year wk52', 1483228800, '2016-W52'],
      ['2019-12-31 -> next ISO year wk01', 1577750400, '2020-W01'],
      ['2020-12-31 -> wk53', 1609372800, '2020-W53'],
    ])('ISO week %s', (_label, epoch, expected) => {
      expect(one('gmtime | strftime("%G-W%V")', epoch)).toBe(expected)
    })
  })

  describe('strftime — input handling', () => {
    it('formats a full ISO timestamp from an array', () => {
      expect(one('strftime("%Y-%m-%dT%H:%M:%SZ")', BROKEN_DOWN)).toBe('2015-03-05T23:51:47Z')
    })

    it('accepts a number (epoch) like jq 1.7+', () => {
      expect(one('strftime("%Y-%m-%d %H:%M:%S")', EPOCH)).toBe('2015-03-05 23:51:47')
    })

    it('truncates fractional seconds in %S', () => {
      expect(one('strftime("%S")', EPOCH + 0.9)).toBe('47')
    })

    it('requires a string format', () => {
      expect(() => evalExpr('strftime(123)', EPOCH)).toThrow(/requires a string format/)
    })

    it('%s yields the UTC epoch of the broken-down time (documented deviation)', () => {
      expect(one('strftime("%s")', BROKEN_DOWN)).toBe(String(EPOCH))
    })
  })

  describe('strflocaltime', () => {
    it('formats local year matching a local Date (wiring)', () => {
      const expectedYear = String(new Date(EPOCH * 1000).getFullYear())
      expect(one('strflocaltime("%Y")', EPOCH)).toBe(expectedYear)
    })

    it('emits a numeric %z offset of the right shape', () => {
      expect(one('strflocaltime("%z")', EPOCH)).toMatch(/^[+-]\d{4}$/)
    })

    it('emits a non-empty %Z timezone name', () => {
      expect(one('strflocaltime("%Z")', EPOCH)).toMatch(/.+/)
    })

    it('accepts a broken-down array and a full format', () => {
      expect(one('strflocaltime("%Y-%m-%d")', BROKEN_DOWN)).toBe('2015-03-05')
    })
  })

  describe('strptime', () => {
    it('parses an ISO timestamp into jq’s struct-tm array', () => {
      expect(one('strptime("%Y-%m-%dT%H:%M:%SZ")', '2015-03-05T23:51:47Z')).toEqual(BROKEN_DOWN)
    })

    it('round-trips through mktime', () => {
      expect(one('strptime("%Y-%m-%dT%H:%M:%SZ") | mktime', '2015-03-05T23:51:47Z')).toBe(EPOCH)
    })

    it('parses named months (%B) and recomputes weekday/day-of-year', () => {
      expect(one('strptime("%d %B %Y")', '05 March 2015')).toEqual([2015, 2, 5, 0, 0, 0, 4, 63])
    })

    it('parses abbreviated months (%b)', () => {
      expect(one('strptime("%d %b %Y")', '05 Mar 2015')).toEqual([2015, 2, 5, 0, 0, 0, 4, 63])
    })

    it('consumes a weekday name (%A) without affecting the result', () => {
      expect(one('strptime("%A %d %B %Y")', 'Thursday 05 March 2015')).toEqual([
        2015, 2, 5, 0, 0, 0, 4, 63,
      ])
    })

    it.each<[string, number]>([
      ['68-01-01', 2068],
      ['69-01-01', 1969],
      ['99-01-01', 1999],
      ['00-01-01', 2000],
    ])('applies the %%y pivot for %s', (input, year) => {
      expect((one('strptime("%y-%m-%d")', input) as number[])[0]).toBe(year)
    })

    it('applies %p in 12-hour parsing', () => {
      expect(one('strptime("%Y-%m-%d %I:%M %p") | mktime', '2015-03-05 11:51 PM')).toBe(
        EPOCH - 47 // no seconds in the format
      )
    })

    it('consumes a %z offset without shifting the wall-clock fields (matches jq)', () => {
      // jq keeps the literal 23:51:47; the +05:30 offset is parsed but dropped.
      expect(one('strptime("%Y-%m-%dT%H:%M:%S%z")', '2015-03-05T23:51:47+05:30')).toEqual(
        BROKEN_DOWN
      )
    })

    it('handles the Z designator in %z', () => {
      expect(one('strptime("%Y-%m-%dT%H:%M:%S%z") | mktime', '2015-03-05T23:51:47Z')).toBe(EPOCH)
    })

    it('collapses whitespace runs in the format', () => {
      expect(one('strptime("%Y   %m   %d")', '2015 03 05')).toEqual([2015, 2, 5, 0, 0, 0, 4, 63])
    })

    it('matches %% literally', () => {
      expect(one('strptime("%Y%%%m")', '2015%03')).toEqual([2015, 2, 1, 0, 0, 0, 0, 59])
    })

    it('defaults unparsed fields to the 1900 epoch start', () => {
      expect(one('strptime("%H:%M")', '06:30')).toEqual([1900, 0, 1, 6, 30, 0, 1, 0])
    })

    it.each<[string, string]>([
      ['non-matching literal', 'foo'],
      ['too short for digits', ''],
    ])('rejects input that does not match (%s)', (_label, input) => {
      expect(() => evalExpr('strptime("%Y-%m-%d")', JSON.stringify(input))).toThrow(
        /does not match format/
      )
    })

    it('rejects a non-string input', () => {
      expect(() => evalExpr('strptime("%Y")', 123)).toThrow(/requires a string/)
    })

    it('requires a string format', () => {
      expect(() => evalExpr('strptime(123)', '"2015"')).toThrow(/requires a string format/)
    })

    it('parses a %z offset without a colon', () => {
      expect(one('strptime("%Y-%m-%dT%H:%M:%S%z")', '2015-03-05T23:51:47+0530')).toEqual(
        BROKEN_DOWN
      )
    })

    it('parses a negative %z offset', () => {
      expect(one('strptime("%Y-%m-%dT%H:%M:%S%z")', '2015-03-05T23:51:47-0600')).toEqual(
        BROKEN_DOWN
      )
    })

    it('consumes a named timezone via %Z', () => {
      expect(one('strptime("%Y-%m-%d %H:%M:%S %Z")', '2015-03-05 23:51:47 UTC')).toEqual(
        BROKEN_DOWN
      )
    })

    it('treats %n and %t as flexible whitespace', () => {
      expect(one('strptime("%Y%n%m%t%d")', '2015 03\t05')).toEqual([2015, 2, 5, 0, 0, 0, 4, 63])
    })

    it('rejects an invalid AM/PM token', () => {
      expect(() => evalExpr('strptime("%I %p")', '11 ZZ')).toThrow(/does not match format/)
    })

    it('rejects an unknown strptime specifier', () => {
      expect(() => evalExpr('strptime("%Q")', '"x"')).toThrow(/does not match format/)
    })

    it('consumes %j (day-of-year) but lets the calendar date drive the result', () => {
      expect(one('strptime("%Y-%m-%d (%j)")', '2015-03-05 (064)')).toEqual(
        BROKEN_DOWN.slice(0, 3).concat([0, 0, 0, 4, 63])
      )
    })

    it('parses 12 AM as midnight (hour 0)', () => {
      expect(one('strptime("%Y-%m-%d %I %p")', '2015-03-05 12 AM')).toEqual([
        2015, 2, 5, 0, 0, 0, 4, 63,
      ])
    })
  })

  describe('todate / fromdate', () => {
    it('todate and todateiso8601 format an epoch as ISO-8601', () => {
      expect(one('todate', EPOCH)).toBe('2015-03-05T23:51:47Z')
      expect(one('todateiso8601', EPOCH)).toBe('2015-03-05T23:51:47Z')
    })

    it('truncates fractional seconds', () => {
      expect(one('todate', EPOCH + 0.9)).toBe('2015-03-05T23:51:47Z')
    })

    it('formats the epoch origin and a negative epoch', () => {
      expect(one('todate', 0)).toBe('1970-01-01T00:00:00Z')
      expect(one('todate', -1)).toBe('1969-12-31T23:59:59Z')
    })

    it('fromdate and fromdateiso8601 parse ISO-8601 back to an epoch', () => {
      expect(one('fromdate', '2015-03-05T23:51:47Z')).toBe(EPOCH)
      expect(one('fromdateiso8601', '2015-03-05T23:51:47Z')).toBe(EPOCH)
    })

    it.each([0, EPOCH, 1700000000, 4102444800])('round-trips epoch %i', (epoch) => {
      expect(one('todate | fromdate', epoch)).toBe(epoch)
    })

    it('todate rejects a non-number', () => {
      expect(() => evalExpr('todate', '"x"')).toThrow(/requires numeric inputs/)
    })

    it('fromdate rejects a malformed string', () => {
      expect(() => evalExpr('fromdate', '"not-a-date"')).toThrow(/does not match format/)
    })
  })

  describe('now (clock injection)', () => {
    it('throws when no clock is injected', () => {
      expect(() => evalExpr('now')).toThrow(/requires an injected clock/)
    })

    it('throws even when the program only uses now downstream', () => {
      expect(() => evalExpr('now | todate')).toThrow(/requires an injected clock/)
    })

    it('returns an injected epoch number', () => {
      expect(one('now', null, { now: EPOCH })).toBe(EPOCH)
    })

    it('accepts a fractional epoch number', () => {
      expect(one('now', null, { now: EPOCH + 0.5 })).toBe(EPOCH + 0.5)
    })

    it('accepts a Date', () => {
      expect(one('now', null, { now: new Date('2015-03-05T23:51:47Z') })).toBe(EPOCH)
    })

    it('feeds downstream date builtins', () => {
      expect(one('now | todate', null, { now: new Date('2015-03-05T23:51:47Z') })).toBe(
        '2015-03-05T23:51:47Z'
      )
      expect(one('now | gmtime', null, { now: EPOCH })).toEqual(BROKEN_DOWN)
    })

    it('ignores the input value (arity 0, input-independent)', () => {
      expect(one('now', { anything: true }, { now: EPOCH })).toBe(EPOCH)
    })

    it('is deterministic for a fixed injected clock', () => {
      expect(evalExpr('now', null, { now: EPOCH })).toEqual(evalExpr('now', null, { now: EPOCH }))
    })
  })

  describe('arity validation', () => {
    it.each(['now/1', 'gmtime/1', 'mktime/1', 'todate/1', 'fromdate/1'])(
      'rejects calling %s with the wrong arity',
      (sig) => {
        const [name] = sig.split('/')
        expect(() => evalExpr(`${name}(1)`)).toThrow(/Unknown function|arity|argument/i)
      }
    )

    it.each(['strftime', 'strptime', 'strflocaltime'])(
      'rejects calling %s with arity 0',
      (name) => {
        expect(() => evalExpr(`1 | ${name}`)).toThrow(/Unknown function|arity|argument/i)
      }
    )

    it('rejects an entirely unknown date-ish function', () => {
      expect(() => evalExpr('dateadd(1)')).toThrow(/Unknown function/)
    })
  })
})
