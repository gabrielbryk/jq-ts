import type { FilterNode } from './ast'
import { visit } from './validate/visit'

/**
 * Validates the AST for correctness and supported features.
 * Checks for unknown function calls and arity mismatches.
 *
 * @param node - The root AST node to validate.
 * @throws {ValidationError} If validation fails.
 */
export const validate = (node: FilterNode): void => {
  visit(node, [])
}
