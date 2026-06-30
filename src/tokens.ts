import type { Span } from './span'

/** The discriminant identifying the category of a lexed {@link Token}. */
export type TokenKind =
  | 'Null'
  | 'True'
  | 'False'
  | 'Number'
  | 'String'
  | 'StringStart'
  | 'StringMiddle'
  | 'StringEnd'
  | 'Identifier'
  | 'Variable'
  | 'Format'
  | 'Dot'
  | 'Comma'
  | 'Pipe'
  | 'Alt'
  | 'LParen'
  | 'RParen'
  | 'LBracket'
  | 'RBracket'
  | 'LBrace'
  | 'RBrace'
  | 'Colon'
  | 'Plus'
  | 'Minus'
  | 'Star'
  | 'Slash'
  | 'Percent'
  | 'EqualEqual'
  | 'BangEqual'
  | 'Less'
  | 'LessEqual'
  | 'Greater'
  | 'GreaterEqual'
  | 'If'
  | 'Then'
  | 'Elif'
  | 'Else'
  | 'End'
  | 'As'
  | 'And'
  | 'Or'
  | 'Not'
  | 'Reduce'
  | 'Foreach'
  | 'Try'
  | 'Catch'
  | 'DotDot'
  | 'Semicolon'
  | 'Eq'
  | 'BarEq'
  | 'PlusEq'
  | 'MinusEq'
  | 'StarEq'
  | 'SlashEq'
  | 'PercentEq'
  | 'AltEq'
  | 'Def'
  | 'Label'
  | 'Break'
  | 'Question'
  | 'EOF'

/** A single lexical token with its kind, source location, and optional payload. */
export interface Token {
  kind: TokenKind
  span: Span
  /**
   * The token's literal payload, whose meaning depends on {@link kind}:
   * the numeric value for `Number`, the decoded text for `String`,
   * `StringStart`, `StringMiddle`, and `StringEnd`, the name for
   * `Identifier`, `Variable`, and `Format` (the format name without the
   * leading `@`). Undefined for tokens that carry no payload
   * (punctuation, operators, keywords).
   */
  value?: string | number
}

/** Maps reserved keyword spellings to their {@link TokenKind}; other identifiers map to undefined. */
export const keywordKinds: Record<string, TokenKind | undefined> = {
  if: 'If',
  then: 'Then',
  elif: 'Elif',
  else: 'Else',
  end: 'End',
  as: 'As',
  and: 'And',
  or: 'Or',
  not: 'Not',
  null: 'Null',
  true: 'True',
  false: 'False',
  reduce: 'Reduce',
  foreach: 'Foreach',
  try: 'Try',
  catch: 'Catch',
  def: 'Def',
  label: 'Label',
  break: 'Break',
}
