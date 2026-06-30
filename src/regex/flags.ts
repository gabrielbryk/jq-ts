import type { RegexFlags } from './ast'
import { RegexError } from './errors'

/**
 * Parses a jq/Oniguruma-style flag string into a normalized {@link RegexFlags}.
 *
 * Recognized flags: `i` (ignore case), `m` (multiline `^`/`$`), `s` (dot matches
 * newline), `x` (extended), and `g` (global — accepted and ignored here because
 * global iteration is handled by the builtin layer). Any other flag character
 * throws a {@link RegexError} naming the unknown flag.
 *
 * @param flags - The flag string (e.g. `"ix"`).
 */
export const parseFlags = (flags: string): RegexFlags => {
  const result: RegexFlags = {
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    extended: false,
  }
  for (const ch of flags) {
    switch (ch) {
      case 'i':
        result.ignoreCase = true
        break
      case 'm':
        result.multiline = true
        break
      case 's':
        result.dotAll = true
        break
      case 'x':
        result.extended = true
        break
      case 'g':
        break
      default:
        throw new RegexError(`unknown regex flag: '${ch}'`)
    }
  }
  return result
}
