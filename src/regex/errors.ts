/**
 * Error thrown by the linear-time regex engine for invalid patterns, invalid
 * flags, or patterns that use features incompatible with linear matching
 * (backreferences, lookaround, atomic groups, possessive quantifiers).
 *
 * The message always names the offending construct so that callers (the jq
 * regex builtins) can surface predictable, descriptive failures.
 */
export class RegexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegexError'
  }
}
