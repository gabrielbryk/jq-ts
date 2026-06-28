import { RuntimeError } from '../../errors'
import type { Span } from '../../span'

/** Accumulated calendar components while scanning a strptime input. */
export interface ParseState {
  year: number
  mon: number
  mday: number
  hour: number
  min: number
  sec: number
}

/**
 * A cursor over the input string with the low-level token readers strptime
 * needs. Keeping the mutable scan position behind a small object keeps the
 * per-specifier handlers branch-light.
 */
export class Scanner {
  s = 0
  constructor(
    readonly input: string,
    readonly fmt: string,
    readonly span: Span
  ) {}

  fail(): never {
    throw new RuntimeError(`date "${this.input}" does not match format "${this.fmt}"`, this.span)
  }

  readInt(maxLen: number): number {
    const start = this.s
    if (this.input[this.s] === '+' || this.input[this.s] === '-') this.s++
    let digits = 0
    while (this.s < this.input.length && digits < maxLen && /[0-9]/.test(this.input[this.s]!)) {
      this.s++
      digits++
    }
    if (digits === 0) this.fail()
    return parseInt(this.input.slice(start, this.s), 10)
  }

  matchName(names: readonly string[]): number {
    const lower = this.input.slice(this.s).toLowerCase()
    let best = -1
    let bestLen = 0
    names.forEach((name, index) => {
      const n = name.toLowerCase()
      if (lower.startsWith(n) && n.length > bestLen) {
        best = index
        bestLen = n.length
      }
    })
    if (best < 0) this.fail()
    this.s += bestLen
    return best
  }

  skipSpaces(): void {
    while (this.s < this.input.length && this.input[this.s] === ' ') this.s++
  }

  skipWhitespace(): void {
    while (this.s < this.input.length && /\s/.test(this.input[this.s]!)) this.s++
  }
}
