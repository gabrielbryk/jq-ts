import type { BuiltinSpec } from '../types'
import { emit } from '../utils'
import { ISO8601 } from './constants'
import { epochFromFields, fieldsFromArray, fieldsFromEpoch, fieldsToArray } from './fields'
import { formatStrftime } from './format'
import { requireNumber, requireString } from './guards'
import { parseStrptime } from './parse'

/**
 * Factory helpers for the arity-0 date builtins (epoch ↔ array/string). Keeping
 * the repetitive generator bodies here keeps the registry declarative.
 */

/** `epoch -> broken-down array` (gmtime / localtime). */
export const epochToArrayBuiltin = (name: string, utc: boolean): BuiltinSpec => ({
  name,
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    yield emit(fieldsToArray(fieldsFromEpoch(requireNumber(input, name, span), utc)), span, tracker)
  },
})

/** `epoch -> ISO-8601 string` (todate / todateiso8601). */
export const epochToIsoBuiltin = (name: string): BuiltinSpec => ({
  name,
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    const fields = fieldsFromEpoch(requireNumber(input, name, span), true)
    yield emit(formatStrftime(fields, ISO8601, true), span, tracker)
  },
})

/** `ISO-8601 string -> epoch` (fromdate / fromdateiso8601). */
export const isoToEpochBuiltin = (name: string): BuiltinSpec => ({
  name,
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    const fields = parseStrptime(requireString(input, name, span), ISO8601, span)
    yield emit(epochFromFields(fields, true), span, tracker)
  },
})

/** `mktime`: broken-down array -> epoch seconds. */
export const mktimeBuiltin = (): BuiltinSpec => ({
  name: 'mktime',
  arity: 0,
  apply: function* (input, _args, _env, tracker, _eval, span) {
    yield emit(epochFromFields(fieldsFromArray(input, 'mktime', span), true), span, tracker)
  },
})

/** `now`: reads the injected clock instant (the only non-pure builtin). */
export const nowBuiltin = (): BuiltinSpec => ({
  name: 'now',
  arity: 0,
  apply: function* (_input, _args, _env, tracker, _eval, span) {
    yield emit(tracker.clock.now(span), span, tracker)
  },
})
