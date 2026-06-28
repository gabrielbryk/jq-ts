import type { FilterNode } from '../ast'

export const semanticWarnings: Record<string, string> = {
  unique: 'jq sorts unique results; jq-ts preserves first-seen order for determinism.',
  unique_by: 'jq sorts unique_by results by key; jq-ts preserves first-seen order.',
  to_entries: 'jq preserves object insertion order; jq-ts sorts object keys deterministically.',
  with_entries: 'jq preserves object insertion order; jq-ts processes object keys in sorted order.',
  tostring:
    'jq stringifies objects in input key order; jq-ts uses stable sorted-key stringification.',
  tojson: 'jq tojson preserves input object order; jq-ts uses stable sorted-key stringification.',
  infinite:
    'jq serializes infinite as a finite JSON number; jq-ts returns JavaScript Infinity internally.',
}

export const specialVariableWarnings: Record<string, string> = {
  ENV: 'jq $ENV is an environment snapshot; jq-ts does not populate it unless the caller injects an ENV variable.',
  __loc__:
    'jq $__loc__ reports source location metadata; jq-ts does not populate it unless the caller injects a __loc__ variable.',
  JQ_BUILD_CONFIGURATION:
    'jq $JQ_BUILD_CONFIGURATION reports jq build metadata; jq-ts does not populate it unless the caller injects a JQ_BUILD_CONFIGURATION variable.',
  ARGS: 'jq $ARGS is populated from CLI arguments; jq-ts does not populate it unless the caller injects an ARGS variable.',
}

export const syntaxWarningsByKind: Partial<Record<FilterNode['kind'], string>> = {
  Slice:
    'jq slice bounds have jq-specific numeric coercion; jq-ts uses JavaScript slice semantics.',
}
