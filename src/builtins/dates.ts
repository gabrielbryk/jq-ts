import {
  epochToArrayBuiltin,
  epochToIsoBuiltin,
  isoToEpochBuiltin,
  mktimeBuiltin,
  nowBuiltin,
} from './dates/factories-epoch'
import { strftimeBuiltin, strptimeBuiltin } from './dates/factories-strf'
import type { BuiltinSpec } from './types'

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
 *
 * The implementation is split across ./dates/: `constants` (calendar tables),
 * `fields` (epoch ↔ broken-down conversions), `format` (strftime), `parse`
 * (strptime), and `factories` (the {@link BuiltinSpec} builders below).
 */
export const dateBuiltins: BuiltinSpec[] = [
  nowBuiltin(),
  epochToArrayBuiltin('gmtime', true),
  epochToArrayBuiltin('localtime', false),
  mktimeBuiltin(),
  strftimeBuiltin('strftime', true),
  strftimeBuiltin('strflocaltime', false),
  strptimeBuiltin(),
  epochToIsoBuiltin('todate'),
  epochToIsoBuiltin('todateiso8601'),
  isoToEpochBuiltin('fromdate'),
  isoToEpochBuiltin('fromdateiso8601'),
]
