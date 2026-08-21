/**
 * Dependency-free, in-memory search for locally extracted PDF pages.
 *
 * The index uses BM25 term scoring, phrase and proximity boosts, and short
 * page-scoped passages. It intentionally returns evidence rather than a
 * generated answer so every result remains traceable to the source PDF.
 */

export interface SearchablePdfPage {
  pageNumber: number
  text?: string | null
  markdown?: string | null
}

export interface SearchHighlight {
  /** Inclusive character offset in `snippet`. */
  start: number
  /** Exclusive character offset in `snippet`. */
  end: number
}

export interface LocalSearchResult {
  id: string
  pageNumber: number
  citation: string
  /** Relevance relative to the best result, between 0 and 1. */
  score: number
  snippet: string
  highlights: SearchHighlight[]
  matchedTerms: string[]
  /** The complete page passage used to produce the snippet. */
  sourceText: string
}

export interface LocalSearchResponse {
  query: string
  results: LocalSearchResult[]
  /** Number of non-empty pages included in the index. */
  searchedPages: number
  /** Number of matching passages before the result limit was applied. */
  totalMatches: number
}

export interface LocalSearchOptions {
  /** Maximum results returned. Defaults to 8. */
  limit?: number
  /** Maximum results from the same PDF page. Defaults to 2. */
  maxResultsPerPage?: number
  /** Approximate maximum snippet length. Defaults to 320 characters. */
  snippetLength?: number
  /** Minimum relative relevance, between 0 and 1. Defaults to 0.08. */
  minScore?: number
}

interface SearchToken {
  value: string
  start: number
  end: number
}

interface IndexedPassage {
  id: string
  pageNumber: number
  passageIndex: number
  text: string
  tokens: SearchToken[]
  termFrequency: Map<string, number>
}

interface ParsedQuery {
  terms: string[]
  uniqueTerms: string[]
  phrases: string[][]
  fullPhrase: string[]
}

interface ScoredPassage {
  passage: IndexedPassage
  rawScore: number
  matchedTerms: string[]
}

const DEFAULT_LIMIT = 8
const DEFAULT_MAX_RESULTS_PER_PAGE = 2
const DEFAULT_SNIPPET_LENGTH = 320
const DEFAULT_MIN_SCORE = 0.08
const TARGET_PASSAGE_LENGTH = 850
const MAX_PASSAGE_LENGTH = 1_200
const MIN_OPTION_VALUE = 1

// Deliberately retain legal operators such as "not", "shall", and "must".
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "by",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "ours",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
])

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?/gu

/**
 * Reusable local index. Create one when the document is parsed, then call
 * `search` for each query without rebuilding page passages or term statistics.
 */
export class LocalSearchIndex {
  readonly pageCount: number
  readonly passageCount: number

  private readonly passages: IndexedPassage[]
  private readonly documentFrequency: Map<string, number>
  private readonly averagePassageLength: number

  constructor(pages: readonly SearchablePdfPage[]) {
    const indexedPages = normalisePages(pages)
    this.pageCount = indexedPages.length
    this.passages = indexedPages.flatMap((page) =>
      buildPassages(page.text).map((text, passageIndex) =>
        indexPassage(page.pageNumber, passageIndex, text),
      ),
    )
    this.passageCount = this.passages.length
    this.documentFrequency = buildDocumentFrequency(this.passages)
    this.averagePassageLength = this.passageCount
      ? this.passages.reduce((total, passage) => total + passage.tokens.length, 0) /
        this.passageCount
      : 0
  }

  search(query: string, options: LocalSearchOptions = {}): LocalSearchResponse {
    const cleanQuery = query.trim()
    const parsedQuery = parseQuery(cleanQuery)

    if (!cleanQuery || !parsedQuery.uniqueTerms.length || !this.passages.length) {
      return {
        query: cleanQuery,
        results: [],
        searchedPages: this.pageCount,
        totalMatches: 0,
      }
    }

    const scored = this.passages
      .map((passage) => this.scorePassage(passage, parsedQuery))
      .filter((candidate): candidate is ScoredPassage => candidate !== null)
      .sort(compareScoredPassages)

    if (!scored.length) {
      return {
        query: cleanQuery,
        results: [],
        searchedPages: this.pageCount,
        totalMatches: 0,
      }
    }

    const limit = clampInteger(options.limit, DEFAULT_LIMIT, MIN_OPTION_VALUE, 50)
    const perPage = clampInteger(
      options.maxResultsPerPage,
      DEFAULT_MAX_RESULTS_PER_PAGE,
      MIN_OPTION_VALUE,
      10,
    )
    const snippetLength = clampInteger(
      options.snippetLength,
      DEFAULT_SNIPPET_LENGTH,
      120,
      1_000,
    )
    const minScore = clampNumber(options.minScore, DEFAULT_MIN_SCORE, 0, 1)
    const bestRawScore = scored[0].rawScore
    const eligible = scored.filter(
      (candidate) => candidate.rawScore / bestRawScore >= minScore,
    )
    const pageCounts = new Map<number, number>()
    const selected: ScoredPassage[] = []

    for (const candidate of eligible) {
      const existingCount = pageCounts.get(candidate.passage.pageNumber) ?? 0
      if (existingCount >= perPage) continue

      selected.push(candidate)
      pageCounts.set(candidate.passage.pageNumber, existingCount + 1)
      if (selected.length >= limit) break
    }

    return {
      query: cleanQuery,
      results: selected.map((candidate) => {
        const snippet = buildSnippet(
          candidate.passage.text,
          new Set(candidate.matchedTerms),
          snippetLength,
        )

        return {
          id: candidate.passage.id,
          pageNumber: candidate.passage.pageNumber,
          citation: `Page ${candidate.passage.pageNumber}`,
          score: roundScore(candidate.rawScore / bestRawScore),
          snippet: snippet.text,
          highlights: snippet.highlights,
          matchedTerms: candidate.matchedTerms,
          sourceText: candidate.passage.text,
        }
      }),
      searchedPages: this.pageCount,
      totalMatches: eligible.length,
    }
  }

  private scorePassage(
    passage: IndexedPassage,
    query: ParsedQuery,
  ): ScoredPassage | null {
    const matchedTerms = query.uniqueTerms.filter((term) =>
      passage.termFrequency.has(term),
    )
    if (!matchedTerms.length) return null

    const queryFrequency = countTerms(query.terms)
    const passageLength = Math.max(passage.tokens.length, 1)
    const averageLength = Math.max(this.averagePassageLength, 1)
    const k1 = 1.4
    const b = 0.68
    let score = 0

    for (const term of query.uniqueTerms) {
      const frequency = passage.termFrequency.get(term) ?? 0
      if (!frequency) continue

      const documentsWithTerm = this.documentFrequency.get(term) ?? 0
      const inverseDocumentFrequency = Math.log(
        1 +
          (this.passageCount - documentsWithTerm + 0.5) /
            (documentsWithTerm + 0.5),
      )
      const saturation =
        (frequency * (k1 + 1)) /
        (frequency + k1 * (1 - b + b * (passageLength / averageLength)))
      const queryWeight = 1 + Math.log(queryFrequency.get(term) ?? 1)
      score += inverseDocumentFrequency * saturation * queryWeight
    }

    const coverage = matchedTerms.length / query.uniqueTerms.length
    score *= 0.45 + coverage * 0.55

    const averageMatchedIdf =
      matchedTerms.reduce((total, term) => {
        const documentsWithTerm = this.documentFrequency.get(term) ?? 0
        return (
          total +
          Math.log(
            1 +
              (this.passageCount - documentsWithTerm + 0.5) /
                (documentsWithTerm + 0.5),
          )
        )
      }, 0) / matchedTerms.length

    for (const phrase of query.phrases) {
      if (containsTokenPhrase(passage.tokens, phrase)) {
        score += averageMatchedIdf * (2.2 + phrase.length * 0.2)
      }
    }

    if (
      query.fullPhrase.length > 1 &&
      containsTokenPhrase(passage.tokens, query.fullPhrase)
    ) {
      score += averageMatchedIdf * 1.25
    }

    score += proximityBoost(passage.tokens, matchedTerms, averageMatchedIdf)

    return {
      passage,
      rawScore: score,
      matchedTerms,
    }
  }
}

export function createLocalSearchIndex(
  pages: readonly SearchablePdfPage[],
): LocalSearchIndex {
  return new LocalSearchIndex(pages)
}

/** Convenience API for one-off searches. */
export function searchExtractedPages(
  pages: readonly SearchablePdfPage[],
  query: string,
  options: LocalSearchOptions = {},
): LocalSearchResponse {
  return createLocalSearchIndex(pages).search(query, options)
}

function normalisePages(
  pages: readonly SearchablePdfPage[],
): Array<{ pageNumber: number; text: string }> {
  return pages.flatMap((page) => {
    const pageNumber = Math.trunc(page.pageNumber)
    if (!Number.isFinite(pageNumber) || pageNumber < 1) return []

    const rawText = page.text?.trim()
      ? page.text
      : markdownToPlainText(page.markdown ?? "")
    const text = normaliseWhitespace(rawText)
    return text ? [{ pageNumber, text }] : []
  })
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\|/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function normaliseWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function buildPassages(text: string): string[] {
  if (text.length <= MAX_PASSAGE_LENGTH) {
    return [collapseForDisplay(text)]
  }

  const paragraphs = text
    .split(/\n\s*\n+/)
    .flatMap((paragraph) => splitLongUnit(collapseForDisplay(paragraph)))
    .filter(Boolean)
  const passages: string[] = []
  let buffer = ""

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph
    if (candidate.length <= MAX_PASSAGE_LENGTH) {
      buffer = candidate
      continue
    }

    if (buffer) passages.push(collapseForDisplay(buffer))
    buffer = paragraph

    if (buffer.length >= TARGET_PASSAGE_LENGTH) {
      passages.push(collapseForDisplay(buffer))
      buffer = ""
    }
  }

  if (buffer) passages.push(collapseForDisplay(buffer))
  return passages.filter(Boolean)
}

function splitLongUnit(value: string): string[] {
  if (value.length <= MAX_PASSAGE_LENGTH) return value ? [value] : []

  const sentences = splitSentences(value)
  const chunks: string[] = []
  let buffer = ""

  for (const sentence of sentences) {
    if (sentence.length > MAX_PASSAGE_LENGTH) {
      if (buffer) {
        chunks.push(buffer)
        buffer = ""
      }
      chunks.push(...splitAtWordBoundary(sentence, MAX_PASSAGE_LENGTH))
      continue
    }

    const candidate = buffer ? `${buffer} ${sentence}` : sentence
    if (candidate.length > MAX_PASSAGE_LENGTH && buffer) {
      chunks.push(buffer)
      buffer = sentence
    } else {
      buffer = candidate
    }
  }

  if (buffer) chunks.push(buffer)
  return chunks
}

function splitSentences(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" })
    return Array.from(segmenter.segment(value), ({ segment }) => segment.trim()).filter(
      Boolean,
    )
  }

  return value
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function splitAtWordBoundary(value: string, maxLength: number): string[] {
  const chunks: string[] = []
  let remaining = value.trim()

  while (remaining.length > maxLength) {
    const proposed = remaining.slice(0, maxLength)
    const boundary = proposed.lastIndexOf(" ")
    const end = boundary >= maxLength * 0.65 ? boundary : maxLength
    chunks.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trim()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

function collapseForDisplay(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function indexPassage(
  pageNumber: number,
  passageIndex: number,
  text: string,
): IndexedPassage {
  const tokens = tokenise(text)
  return {
    id: `${pageNumber}:${passageIndex}`,
    pageNumber,
    passageIndex,
    text,
    tokens,
    termFrequency: countTerms(tokens.map((token) => token.value)),
  }
}

function tokenise(value: string): SearchToken[] {
  const tokens: SearchToken[] = []
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const original = match[0]
    const start = match.index ?? 0
    const normalised = normaliseToken(original)
    if (!normalised) continue
    tokens.push({ value: normalised, start, end: start + original.length })
  }
  return tokens
}

function normaliseToken(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, "")
    .toLocaleLowerCase("en-US")
}

function parseQuery(query: string): ParsedQuery {
  const allTokens = tokenise(query).map((token) => token.value)
  const meaningfulTerms = allTokens.filter((term) => !STOP_WORDS.has(term))
  const terms = meaningfulTerms.length ? meaningfulTerms : allTokens
  const phrases = Array.from(query.matchAll(/"([^"]+)"/g))
    .map((match) => tokenise(match[1]).map((token) => token.value))
    .filter((phrase) => phrase.length > 1)

  return {
    terms,
    uniqueTerms: Array.from(new Set(terms)),
    phrases,
    fullPhrase: allTokens,
  }
}

function countTerms(terms: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1)
  return counts
}

function buildDocumentFrequency(
  passages: readonly IndexedPassage[],
): Map<string, number> {
  const frequency = new Map<string, number>()
  for (const passage of passages) {
    for (const term of passage.termFrequency.keys()) {
      frequency.set(term, (frequency.get(term) ?? 0) + 1)
    }
  }
  return frequency
}

function containsTokenPhrase(
  passageTokens: readonly SearchToken[],
  phrase: readonly string[],
): boolean {
  if (!phrase.length || phrase.length > passageTokens.length) return false

  outer: for (let index = 0; index <= passageTokens.length - phrase.length; index += 1) {
    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (passageTokens[index + offset].value !== phrase[offset]) continue outer
    }
    return true
  }
  return false
}

function proximityBoost(
  passageTokens: readonly SearchToken[],
  matchedTerms: readonly string[],
  averageIdf: number,
): number {
  if (matchedTerms.length < 2) return 0

  const terms = new Set(matchedTerms)
  const positions = passageTokens.flatMap((token, index) =>
    terms.has(token.value) ? [{ index, term: token.value }] : [],
  )
  let left = 0
  let bestSpan = Number.POSITIVE_INFINITY
  const windowCounts = new Map<string, number>()

  for (let right = 0; right < positions.length; right += 1) {
    const rightTerm = positions[right].term
    windowCounts.set(rightTerm, (windowCounts.get(rightTerm) ?? 0) + 1)

    while (windowCounts.size === terms.size && left <= right) {
      bestSpan = Math.min(bestSpan, positions[right].index - positions[left].index + 1)
      const leftTerm = positions[left].term
      const remaining = (windowCounts.get(leftTerm) ?? 1) - 1
      if (remaining) windowCounts.set(leftTerm, remaining)
      else windowCounts.delete(leftTerm)
      left += 1
    }
  }

  if (!Number.isFinite(bestSpan)) return 0
  const extraDistance = Math.max(0, bestSpan - terms.size)
  return averageIdf * (0.9 / (1 + extraDistance * 0.25))
}

function buildSnippet(
  text: string,
  matchedTerms: ReadonlySet<string>,
  maxLength: number,
): { text: string; highlights: SearchHighlight[] } {
  const matches = tokenise(text).filter((token) => matchedTerms.has(token.value))
  if (text.length <= maxLength || !matches.length) {
    return {
      text,
      highlights: mergeHighlights(
        matches.map(({ start, end }) => ({ start, end })),
      ),
    }
  }

  let bestStart = 0
  let bestEnd = Math.min(text.length, maxLength)
  let bestScore = -1

  for (const anchor of matches) {
    const proposedStart = Math.max(0, anchor.start - Math.floor(maxLength * 0.35))
    const proposedEnd = Math.min(text.length, proposedStart + maxLength)
    const windowMatches = matches.filter(
      (match) => match.start < proposedEnd && match.end > proposedStart,
    )
    const uniqueTerms = new Set(windowMatches.map((match) => match.value)).size
    const score = uniqueTerms * 10 + windowMatches.length
    if (score > bestScore) {
      bestScore = score
      bestStart = proposedStart
      bestEnd = proposedEnd
    }
  }

  bestStart = moveToWordStart(text, bestStart)
  bestEnd = moveToWordEnd(text, bestEnd)
  const hasPrefix = bestStart > 0
  const hasSuffix = bestEnd < text.length
  const prefix = hasPrefix ? "… " : ""
  const suffix = hasSuffix ? " …" : ""
  const snippetText = `${prefix}${text.slice(bestStart, bestEnd).trim()}${suffix}`
  const leadingTrim = text.slice(bestStart, bestEnd).length - text.slice(bestStart, bestEnd).trimStart().length
  const offset = prefix.length - bestStart - leadingTrim
  const highlights = matches
    .filter((match) => match.start >= bestStart && match.end <= bestEnd)
    .map((match) => ({ start: match.start + offset, end: match.end + offset }))
    .filter((match) => match.start >= 0 && match.end <= snippetText.length)

  return { text: snippetText, highlights: mergeHighlights(highlights) }
}

function moveToWordStart(text: string, index: number): number {
  if (index <= 0) return 0
  const nextSpace = text.indexOf(" ", index)
  return nextSpace === -1 ? index : Math.min(nextSpace + 1, text.length)
}

function moveToWordEnd(text: string, index: number): number {
  if (index >= text.length) return text.length
  const previousSpace = text.lastIndexOf(" ", index)
  return previousSpace <= 0 ? index : previousSpace
}

function mergeHighlights(highlights: SearchHighlight[]): SearchHighlight[] {
  const sorted = [...highlights].sort((left, right) => left.start - right.start)
  const merged: SearchHighlight[] = []

  for (const highlight of sorted) {
    const previous = merged.at(-1)
    if (previous && highlight.start <= previous.end) {
      previous.end = Math.max(previous.end, highlight.end)
    } else {
      merged.push({ ...highlight })
    }
  }
  return merged
}

function compareScoredPassages(left: ScoredPassage, right: ScoredPassage): number {
  return (
    right.rawScore - left.rawScore ||
    left.passage.pageNumber - right.passage.pageNumber ||
    left.passage.passageIndex - right.passage.passageIndex
  )
}

function clampInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}

function clampNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

function roundScore(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
