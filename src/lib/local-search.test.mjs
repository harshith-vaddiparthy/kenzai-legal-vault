import assert from "node:assert/strict"
import test from "node:test"

import {
  createLocalSearchIndex,
  searchExtractedPages,
} from "./local-search.ts"

const pages = [
  {
    pageNumber: 1,
    text: "This Agreement begins on the Effective Date and renews annually.",
  },
  {
    pageNumber: 2,
    text: "12. Termination. Either party may terminate this Agreement on thirty days written notice. Exceptions include immediate termination for an uncured material breach.",
  },
  {
    pageNumber: 3,
    text: "Each party shall protect Confidential Information and use it only to perform this Agreement.",
  },
]

test("ranks the strongest legal passage and returns source-linked highlights", () => {
  const response = searchExtractedPages(
    pages,
    "What is the termination notice and are there exceptions?",
  )

  assert.equal(response.searchedPages, 3)
  assert.equal(response.results[0].pageNumber, 2)
  assert.equal(response.results[0].citation, "Page 2")
  assert.equal(response.results[0].score, 1)
  assert.deepEqual(response.results[0].matchedTerms, [
    "termination",
    "notice",
    "exceptions",
  ])
  assert.ok(response.results[0].highlights.length >= 2)

  for (const highlight of response.results[0].highlights) {
    assert.ok(highlight.start >= 0)
    assert.ok(highlight.end <= response.results[0].snippet.length)
    assert.ok(highlight.end > highlight.start)
  }
})

test("boosts an explicitly quoted phrase above separated terms", () => {
  const response = searchExtractedPages(
    [
      {
        pageNumber: 1,
        text: "Confidential records are restricted. Information may be disclosed only as required by law.",
      },
      {
        pageNumber: 2,
        text: "The Receiving Party shall safeguard all Confidential Information.",
      },
    ],
    '"confidential information"',
  )

  assert.equal(response.results[0].pageNumber, 2)
})

test("indexes cleaned Markdown when raw page text is unavailable", () => {
  const response = searchExtractedPages(
    [
      {
        pageNumber: 7,
        markdown:
          "## Governing Law\n\nThis Agreement is governed by the laws of **Karnataka, India**.",
      },
    ],
    "governing law Karnataka",
  )

  assert.equal(response.results[0].citation, "Page 7")
  assert.match(response.results[0].snippet, /Governing Law/)
  assert.doesNotMatch(response.results[0].snippet, /\*\*/)
})

test("supports a reusable index and safely handles empty queries", () => {
  const index = createLocalSearchIndex([
    ...pages,
    { pageNumber: 0, text: "Invalid page number" },
    { pageNumber: 4, text: "" },
  ])

  assert.equal(index.pageCount, 3)
  assert.equal(index.search("confidential").results[0].pageNumber, 3)
  assert.deepEqual(index.search("   ").results, [])
})

test("keeps highlight offsets valid inside a truncated snippet", () => {
  const padding = "Background recital language without a relevant match. ".repeat(8)
  const response = searchExtractedPages(
    [
      {
        pageNumber: 9,
        text: `${padding}The indemnifying party must defend and indemnify the customer. ${padding}`,
      },
    ],
    "defend indemnify",
    { snippetLength: 140 },
  )
  const result = response.results[0]

  assert.match(result.snippet, /^… /)
  assert.match(result.snippet, / …$/)
  assert.deepEqual(
    result.highlights.map(({ start, end }) =>
      result.snippet.slice(start, end).toLocaleLowerCase("en-US"),
    ),
    ["defend", "indemnify"],
  )
})
