import type { FilterNode, ObjectEntry, ObjectKey } from '../ast'

export type Visitor = (node: FilterNode) => void

export const visit = (node: FilterNode, callback: Visitor): void => {
  callback(node)

  switch (node.kind) {
    case 'Identity':
    case 'Literal':
    case 'Var':
    case 'Recurse':
    case 'Break':
      return
    case 'FieldAccess':
      visit(node.target, callback)
      return
    case 'IndexAccess':
      visit(node.target, callback)
      visit(node.index, callback)
      return
    case 'Iterate':
      visit(node.target, callback)
      return
    case 'Slice':
      visit(node.target, callback)
      if (node.start) visit(node.start, callback)
      if (node.end) visit(node.end, callback)
      return
    case 'Array':
      node.items.forEach((item) => visit(item, callback))
      return
    case 'Object':
      node.entries.forEach((entry) => visitObjectEntry(entry, callback))
      return
    case 'Pipe':
    case 'Comma':
    case 'Alt':
    case 'Binary':
    case 'Bool':
      visit(node.left, callback)
      visit(node.right, callback)
      return
    case 'Unary':
      visit(node.expr, callback)
      return
    case 'If':
      node.branches.forEach((branch) => {
        visit(branch.cond, callback)
        visit(branch.then, callback)
      })
      visit(node.else, callback)
      return
    case 'As':
      visit(node.bind, callback)
      visit(node.body, callback)
      return
    case 'Call':
      node.args.forEach((arg) => visit(arg, callback))
      return
    case 'Reduce':
      visit(node.source, callback)
      visit(node.init, callback)
      visit(node.update, callback)
      return
    case 'Foreach':
      visit(node.source, callback)
      visit(node.init, callback)
      visit(node.update, callback)
      if (node.extract) visit(node.extract, callback)
      return
    case 'Try':
      visit(node.body, callback)
      if (node.handler) visit(node.handler, callback)
      return
    case 'Assignment':
      visit(node.left, callback)
      visit(node.right, callback)
      return
    case 'Def':
      visit(node.body, callback)
      visit(node.next, callback)
      return
    case 'Label':
      visit(node.body, callback)
      return
    default: {
      const exhaustive: never = node
      return exhaustive
    }
  }
}

const visitObjectEntry = (entry: ObjectEntry, callback: Visitor): void => {
  visitObjectKey(entry.key, callback)
  visit(entry.value, callback)
}

const visitObjectKey = (key: ObjectKey, callback: Visitor): void => {
  if (key.kind === 'KeyExpr') {
    visit(key.expr, callback)
  }
}
