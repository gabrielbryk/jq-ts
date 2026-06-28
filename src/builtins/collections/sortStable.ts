// Helper for stable sort
export function sortStable<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  return arr
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const cmp = compare(a.item, b.item)
      return cmp !== 0 ? cmp : a.index - b.index
    })
    .map((p) => p.item)
}
