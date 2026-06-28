import type { FilterNode } from './ast'
import { lex } from './lexer'
import { parseDef, parseFilter } from './parser/definitions'
import { parseBracketSuffix } from './parser/postfix'
import { parseComma, parsePipe } from './parser/precedence'
import { ParserState } from './parser/state'

/**
 * Parses a jq source string into an Abstract Syntax Tree (AST).
 *
 * @param source - The input jq query string.
 * @returns The root {@link FilterNode} of the AST.
 * @throws {LexError} If the source contains invalid characters.
 * @throws {ParseError} If the syntax is invalid.
 */
export const parse = (source: string): FilterNode => {
  const state = new ParserState(lex(source))
  // Wire the recursive entry points used across rule modules without forming
  // module import cycles (see ParserState's injected-field comment).
  state.parseDef = parseDef
  state.parsePipe = parsePipe
  state.parseComma = parseComma
  state.parseBracketSuffix = parseBracketSuffix
  return parseFilter(state)
}
