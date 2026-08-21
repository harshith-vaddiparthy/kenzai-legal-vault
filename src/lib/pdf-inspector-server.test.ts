import assert from "node:assert/strict"
import test from "node:test"

const TEXT_PDF_BASE64 =
  "JVBERi0xLjQKJenr8b8KMSAwIG9iago8PAovQ291bnQgMQovS2lkcyBbMyAwIFJdCi9NZWRpYUJveCBbMCAwIDU5NS4yOCA4NDEuODldCi9UeXBlIC9QYWdlcwo+PgplbmRvYmoKMiAwIG9iago8PAovTWFya0luZm8gPDwvTWFya2VkIHRydWU+PgovT3BlbkFjdGlvbiBbMyAwIFIgL0ZpdEggbnVsbF0KL1BhZ2VMYXlvdXQgL09uZUNvbHVtbgovUGFnZXMgMSAwIFIKL1N0cnVjdFRyZWVSb290IDggMCBSCi9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9Db250ZW50cyA0IDAgUgovR3JvdXAgPDwvVHlwZSAvR3JvdXAgL1MgL1RyYW5zcGFyZW5jeSAvQ1MgL0RldmljZVJHQj4+Ci9QYXJlbnQgMSAwIFIKL1Jlc291cmNlcyA3IDAgUgovU3RydWN0UGFyZW50cyAwCi9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9MZW5ndGggMTQ3Cj4+CnN0cmVhbQp4nHXMuwqDMABG4T1P8W/qklsrsSAORostuGV0KSS2lqDFCr5+EXqjl/Vw+CT2hNNYYSasEkhTVutdAZ5lyAtNcgO2FZCccg7TojRLWgkqEqiNovEaxiI07jqhcgfb9ccI5rx8Za0J04N1T1S8oxLiJ5rED/Qydv3UhMHJeT8ETfQfli/4rqgvZR5Gbz+UG1KGPUEKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGQKL0VuY29kaW5nIC9XaW5BbnNpRW5jb2RpbmcKL1N1YnR5cGUgL1R5cGUxCi9UeXBlIC9Gb250Cj4+CmVuZG9iago2IDAgb2JqCjw8Ci9CYXNlRm9udCAvQ291cmllcgovRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZwovU3VidHlwZSAvVHlwZTEKL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0ZvbnQgPDwvRjEgNSAwIFIKL0YyIDYgMCBSPj4KL1Byb2NTZXQgWy9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUldCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9LIFs5IDAgUl0KL1BhcmVudFRyZWUgMTAgMCBSCi9UeXBlIC9TdHJ1Y3RUcmVlUm9vdAo+PgplbmRvYmoKOSAwIG9iago8PAovSyBbMTEgMCBSCjEyIDAgUgoxMyAwIFJdCi9QIDggMCBSCi9TIC9Eb2N1bWVudAovVHlwZSAvU3RydWN0RWxlbQo+PgplbmRvYmoKMTAgMCBvYmoKPDwKL051bXMgWzAgWzExIDAgUgoxMiAwIFIKMTMgMCBSXV0KPj4KZW5kb2JqCjExIDAgb2JqCjw8Ci9LIFswXQovUCA5IDAgUgovUGcgMyAwIFIKL1MgSDEKL1R5cGUgL1N0cnVjdEVsZW0KPj4KZW5kb2JqCjEyIDAgb2JqCjw8Ci9LIFsxXQovUCA5IDAgUgovUGcgMyAwIFIKL1MgQ29kZQovVHlwZSAvU3RydWN0RWxlbQo+PgplbmRvYmoKMTMgMCBvYmoKPDwKL0sgWzJdCi9QIDkgMCBSCi9QZyAzIDAgUgovUyBDb2RlCi9UeXBlIC9TdHJ1Y3RFbGVtCj4+CmVuZG9iagoxNCAwIG9iago8PAovQ3JlYXRpb25EYXRlIChEOjIwMjYwMzE4MDMyMTE4WikKPj4KZW5kb2JqCnhyZWYKMCAxNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDEwMiAwMDAwMCBuIAowMDAwMDAwMjU0IDAwMDAwIG4gCjAwMDAwMDA0MDcgMDAwMDAgbiAKMDAwMDAwMDYyNiAwMDAwMCBuIAowMDAwMDAwNzI4IDAwMDAwIG4gCjAwMDAwMDA4MjMgMDAwMDAgbiAKMDAwMDAwMDkyMCAwMDAwMCBuIAowMDAwMDAwOTkzIDAwMDAwIG4gCjAwMDAwMDEwODAgMDAwMDAgbiAKMDAwMDAwMTEzNSAwMDAwMCBuIAowMDAwMDAxMjA3IDAwMDAwIG4gCjAwMDAwMDEyODEgMDAwMDAgbiAKMDAwMDAwMTM1NSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDE1Ci9Sb290IDIgMCBSCi9JbmZvIDE0IDAgUgovSUQgWzwwMEE2NUIwMzlDRkQ3MjMyRjEzRTlBMzQzODA5QTA2Qz48MDBBNjVCMDM5Q0ZENzIzMkYxM0U5QTM0MzgwOUEwNkM+XQo+PgpzdGFydHhyZWYKMTQxMQolJUVPRgo="

const pdfBuffer = Buffer.from(TEXT_PDF_BASE64, "base64")

async function loadServerModule() {
  try {
    return await import("./pdf-inspector-server")
  } catch {
    return null
  }
}

async function loadRouteModule() {
  try {
    return await import("../app/api/pdf/inspect/route")
  } catch {
    return null
  }
}

test("extracts real page Markdown and parser metadata from a text PDF", async () => {
  const server = await loadServerModule()
  assert.ok(server, "expected the PDF inspection server module to exist")

  const result = await server.inspectPdfBuffer({
    buffer: pdfBuffer,
    fileName: "sample-contract.pdf",
    mimeType: "application/pdf",
  })

  assert.equal(result.status, "complete")
  assert.deepEqual(result.classification, {
    pdfType: "TextBased",
    pageCount: 1,
    confidence: 1,
  })
  assert.equal(result.pages.length, 1)
  assert.equal(result.pages[0].pageNumber, 1)
  assert.match(result.pages[0].markdown, /# Test Heading/)
  assert.equal(result.pages[0].source, "native")
  assert.equal(result.pages[0].needsOcr, false)
  assert.equal(result.ocr.runtimeStatus, "not-required")
  assert.deepEqual(result.ocr.pagesRecommended, [])
  assert.ok(result.timing.totalMs >= 0)
})

test("rejects input whose bytes are not a PDF", async () => {
  const server = await loadServerModule()
  assert.ok(server, "expected the PDF inspection server module to exist")

  await assert.rejects(
    () =>
      server.inspectPdfBuffer({
        buffer: Buffer.from("plain text"),
        fileName: "not-a-pdf.pdf",
        mimeType: "application/pdf",
      }),
    (error: unknown) =>
      error instanceof server.PdfInspectionError &&
      error.code === "invalid_pdf" &&
      error.status === 415,
  )
})

test("POST /api/pdf/inspect accepts a multipart PDF upload", async () => {
  const route = await loadRouteModule()
  assert.ok(route, "expected the PDF inspection route module to exist")

  const body = new FormData()
  body.set(
    "file",
    new File([pdfBuffer], "sample-contract.pdf", { type: "application/pdf" }),
  )

  const response = await route.POST(
    new Request("http://localhost/api/pdf/inspect", { method: "POST", body }),
  )
  const result = await response.json()

  assert.equal(response.status, 200)
  assert.equal(result.document.fileName, "sample-contract.pdf")
  assert.equal(result.pages[0].pageNumber, 1)
  assert.match(result.markdown, /Test Heading/)
})

test("POST /api/pdf/inspect returns a typed error when file is missing", async () => {
  const route = await loadRouteModule()
  assert.ok(route, "expected the PDF inspection route module to exist")

  const response = await route.POST(
    new Request("http://localhost/api/pdf/inspect", {
      method: "POST",
      body: new FormData(),
    }),
  )
  const result = await response.json()

  assert.equal(response.status, 400)
  assert.deepEqual(result.error, {
    code: "missing_file",
    message: "Choose a PDF file to inspect.",
  })
})
