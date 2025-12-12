export interface Span {
  start: number
  end: number
}

export interface Location {
  line: number
  column: number
}

export interface SourceInfo {
  text: string
  lineStarts: number[]
}

export const makeSourceInfo = (text: string): SourceInfo => ({
  text,
  lineStarts: computeLineStarts(text),
})

const computeLineStarts = (text: string): number[] => {
  const starts = [0]
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1)
    }
  }
  return starts
}

export const offsetToLocation = (source: SourceInfo, offset: number): Location => {
  const idx = findLineIndex(source.lineStarts, offset)
  const lineStart = source.lineStarts[idx] ?? 0
  return {
    line: idx + 1,
    column: offset - lineStart + 1,
  }
}

const findLineIndex = (lineStarts: number[], offset: number): number => {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const start = lineStarts[mid] ?? 0
    const next =
      mid + 1 < lineStarts.length
        ? (lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY
    if (offset < start) {
      high = mid - 1
    } else if (offset >= next) {
      low = mid + 1
    } else {
      return mid
    }
  }
  return Math.max(0, Math.min(lineStarts.length - 1, low))
}

export interface FormattedSpan {
  start: Location
  end: Location
  excerpt: string
}

export const formatSpan = (source: SourceInfo, span: Span): FormattedSpan => ({
  start: offsetToLocation(source, span.start),
  end: offsetToLocation(source, Math.max(span.start, span.end - 1)),
  excerpt: extractLine(source, span),
})

const extractLine = (source: SourceInfo, span: Span): string => {
  if (span.start >= source.text.length) {
    return ''
  }
  const lineIdx = findLineIndex(source.lineStarts, span.start)
  const lineStart = source.lineStarts[lineIdx] ?? 0
  const lineEnd =
    lineIdx + 1 < source.lineStarts.length
      ? (source.lineStarts[lineIdx + 1] ?? source.text.length) - 1
      : source.text.length
  return source.text.slice(lineStart, lineEnd).replace(/\r?\n$/, '')
}
