import type { BuiltinSpec } from '../types'
import { fromstreamBuiltins } from './fromstream'
import { tostreamBuiltins } from './tostream'
import { truncateStreamBuiltins } from './truncate'

// --- Streaming builtins: tostream, fromstream, truncate_stream ---

export const streamingBuiltins: BuiltinSpec[] = [
  ...tostreamBuiltins,
  ...fromstreamBuiltins,
  ...truncateStreamBuiltins,
]
