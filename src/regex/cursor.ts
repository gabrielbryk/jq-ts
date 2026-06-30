/**
 * A forward-only cursor over a pattern's codepoint array, shared by the parser
 * and its helpers ({@link "./parse-escape"}, {@link "./parse-class"}).
 */
export class Cursor {
  pos = 0

  constructor(readonly cps: number[]) {}

  /** True once the cursor is past the end of the pattern. */
  eof(): boolean {
    return this.pos >= this.cps.length
  }

  /** Returns the codepoint `offset` ahead without advancing, or `undefined`. */
  peek(offset = 0): number | undefined {
    return this.cps[this.pos + offset]
  }

  /** Returns the current codepoint and advances, or `undefined` at end. */
  next(): number | undefined {
    return this.cps[this.pos++]
  }

  /** Consumes the current codepoint if it equals `cp`; returns whether it did. */
  eat(cp: number): boolean {
    if (this.cps[this.pos] === cp) {
      this.pos++
      return true
    }
    return false
  }
}
