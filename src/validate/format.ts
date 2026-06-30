import { ValidationError } from '../errors'
import { isFormatName } from '../format'
import type { HandlerMap } from './types'

/** Handler for `@`-format nodes: rejects unknown names, validates `str`. */
export const formatHandlers: HandlerMap = {
  Format: (node, scope, visit) => {
    if (!isFormatName(node.name)) {
      throw new ValidationError(`${node.name} is not a valid format`, node.span)
    }
    if (node.str) visit(node.str, scope)
  },
}
