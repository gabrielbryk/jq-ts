/**
 * Represents a range of characters in the source text.
 */
export interface Span {
  start: number
  end: number
}

/**
 * Represents a human-readable location in the source text (line and column).
 */
export interface Location {
  /** 1-based line number */
  line: number
  /** 1-based column number */
  column: number
}

/**
 * Encapsulates source text along with precomputed metadata for efficient location lookups.
 */
export interface SourceInfo {
  text: string
  /** Offsets where each line starts */
  lineStarts: number[]
}

/**
 * Creates a {@link SourceInfo} object from raw source text.
 * Precomputes line start offsets.
 *
 * @param text - The source code.
 * @returns The source info object.
 */
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

/**
 * Converts a byte offset into a line/column location.
 *
 * @param source - The source info.
 * @param offset - The 0-based character offset.
 * @returns The location info.
 */
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

/**
 * Represents a span with resolved line/column information and the source line excerpt.
 */
export interface FormattedSpan {
  start: Location
  end: Location
  excerpt: string
}

/**
 * Resolves a raw {@link Span} into a {@link FormattedSpan} for error reporting.
 *
 * @param source - The source info.
 * @param span - The raw span.
 * @returns The formatted span with excerpt.
 */
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
