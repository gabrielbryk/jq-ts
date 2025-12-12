import type { Span } from './span'

export type TokenKind =
  | 'Null'
  | 'True'
  | 'False'
  | 'Number'
  | 'String'
  | 'Identifier'
  | 'Variable'
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
  | 'EOF'

export interface Token {
  kind: TokenKind
  span: Span
  value?: string | number
}

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
}
