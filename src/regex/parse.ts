import type { RegexNode } from './ast'
import { Cursor } from './cursor'
import { RegexError } from './errors'
import { parseClass } from './parse-class'
import { parseEscape } from './parse-escape'
import { parseGroup } from './parse-group'
import { parseQuantifier } from './parse-quant'
import { skipExtended } from './parse-util'

const PIPE = 0x7c
const LPAREN = 0x28
const RPAREN = 0x29
const LBRACKET = 0x5b
const STAR = 0x2a
const PLUS = 0x2b
const QUEST = 0x3f

/** Result of parsing: the AST root plus capture-group metadata. */
export interface ParseResult {
  node: RegexNode
  groupCount: number
  names: (string | null)[]
}

class Parser {
  private readonly cur: Cursor
  private groupCount = 0
  private readonly names: (string | null)[] = [null]

  constructor(
    pattern: string,
    private readonly extended: boolean
  ) {
    this.cur = new Cursor(Array.from(pattern, (ch) => ch.codePointAt(0) as number))
  }

  parse(): ParseResult {
    const node = this.parseAlt()
    skipExtended(this.cur, this.extended)
    if (!this.cur.eof()) throw new RegexError('unexpected character in pattern')
    return { node, groupCount: this.groupCount, names: this.names }
  }

  private parseAlt(): RegexNode {
    const options = [this.parseConcat()]
    while (this.cur.peek() === PIPE) {
      this.cur.next()
      options.push(this.parseConcat())
    }
    return options.length === 1 ? (options[0] as RegexNode) : { type: 'Alt', options }
  }

  private parseConcat(): RegexNode {
    const parts: RegexNode[] = []
    for (;;) {
      skipExtended(this.cur, this.extended)
      const cp = this.cur.peek()
      if (cp === undefined || cp === PIPE || cp === RPAREN) break
      parts.push(parseQuantifier(this.cur, this.extended, this.parseAtom()))
    }
    if (parts.length === 0) return { type: 'Empty' }
    return parts.length === 1 ? (parts[0] as RegexNode) : { type: 'Concat', parts }
  }

  private parseAtom(): RegexNode {
    const cp = this.cur.next() as number
    if (cp === LPAREN) return this.parseGroup()
    if (cp === LBRACKET) {
      const { negated, items } = parseClass(this.cur)
      return { type: 'Class', negated, items }
    }
    if (cp === 0x2e) return { type: 'AnyChar' }
    if (cp === 0x5e) return { type: 'Anchor', kind: 'start' }
    if (cp === 0x24) return { type: 'Anchor', kind: 'end' }
    if (cp === 0x5c) return this.atomFromEscape()
    if (cp === STAR || cp === PLUS || cp === QUEST) throw new RegexError('nothing to repeat')
    return { type: 'Char', cp }
  }

  private atomFromEscape(): RegexNode {
    const esc = parseEscape(this.cur, false)
    if (esc.kind === 'shorthand') {
      return { type: 'Class', negated: false, items: [{ kind: 'shorthand', cls: esc.cls }] }
    }
    if (esc.kind === 'anchor') return { type: 'Anchor', kind: esc.anchor }
    return { type: 'Char', cp: esc.cp }
  }

  private parseGroup(): RegexNode {
    return parseGroup({
      cur: this.cur,
      parseAlt: () => this.parseAlt(),
      registerCapture: (name) => {
        const capture = ++this.groupCount
        this.names[capture] = name
        return capture
      },
      expect: (cp, message) => this.expect(cp, message),
    })
  }

  private expect(cp: number, message: string): void {
    if (!this.cur.eat(cp)) throw new RegexError(message)
  }
}

/**
 * Parses a regex pattern into an AST.
 *
 * @param pattern - The pattern source.
 * @param extended - Whether the `x` (extended) flag is active.
 * @throws {RegexError} On syntax errors or unsupported constructs.
 */
export const parsePattern = (pattern: string, extended: boolean): ParseResult =>
  new Parser(pattern, extended).parse()
