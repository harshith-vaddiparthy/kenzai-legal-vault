# Kenzai Legal Vault

Kenzai Legal Vault is a local-first PDF inspection workspace for legal and sensitive documents. It combines a real source PDF viewer with page-level extraction, selective OCR, parser diagnostics, and ranked local search.

Documents are stored in the browser's IndexedDB database. Parsing runs through a local Next.js route backed by Firecrawl PDF Inspector. No document content is sent to OpenAI or another hosted model.

## What works

- Upload one or more PDF files from the file picker or by drag and drop
- Persist the local document library across browser refreshes
- Preview and download the original PDF
- Navigate the actual source PDF page by page
- Classify PDFs as text-based, scanned, mixed, or image-based
- Extract page-level Markdown with layout and confidence metadata
- Detect pages with tables and multi-column layouts
- Route only pages that need OCR through local PP-OCRv6 Small
- Show whether each page came from native text, OCR, or fused extraction
- Inspect OCR reasons, confidence, timings, warnings, and hosted-review recommendations
- Search extracted pages locally using BM25 ranking, phrase matching, proximity boosts, snippets, and page citations
- Remove individual files or clear the complete local library
- Collapse and expand the shadcn sidebar on desktop and mobile

OpenAI analysis is intentionally not connected. The UI identifies that boundary explicitly.

## Architecture

```text
Browser PDF upload
  -> IndexedDB local document library
  -> POST /api/pdf/inspect
  -> @firecrawl/pdf-inspector native Node binding
       -> native text and layout extraction
       -> selective local OCR when required
  -> page-level structured response
  -> source viewer + parser inspector + local search
```

## Local development

Requirements:

- Node.js 20 or newer
- npm

Install and run:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000/dashboard](http://127.0.0.1:3000/dashboard).

Native-text PDFs work without an OCR runtime. Scanned and image-only pages require the optional local OCR dependencies below.

## Local OCR setup

The validated runtime versions are:

- Firecrawl PDFium `native-v7988`
- ONNX Runtime `1.27.0`
- PP-OCRv6 Small artifact revision `oar-ocr-v0.7.0`

Download the matching PDFium and ONNX Runtime archives for your platform from:

- [Firecrawl PDFium native-v7988](https://github.com/firecrawl/pdfium-rs/releases/tag/native-v7988)
- [ONNX Runtime 1.27.0](https://github.com/microsoft/onnxruntime/releases/tag/v1.27.0)

Copy `.env.example` to `.env.local` and use absolute paths:

```bash
cp .env.example .env.local
```

```env
PDFIUM_LIB_PATH=/absolute/path/to/libpdfium.dylib
ORT_DYLIB_PATH=/absolute/path/to/libonnxruntime.dylib
PDF_INSPECTOR_MODEL_CACHE=/absolute/path/to/pdf-inspector-model-cache
```

Use `.so` library paths on Linux and `.dll` paths on Windows. The first scanned PDF downloads and checksum-verifies the pinned OCR model set into the configured cache. The model artifacts total roughly 31 MB.

If the runtime is unavailable, the API still returns real native extraction results and marks OCR-required pages as partial instead of inventing text.

## API

`POST /api/pdf/inspect`

Send multipart form data with a `file` field containing a PDF. The local upload limit is 50 MB.

The response includes:

- document metadata and classification
- page count and classification confidence
- per-page Markdown, OCR reasons, source, confidence, warnings, and timings
- table and column page lists
- OCR routing, runtime, and review status
- total parser, rendering, and OCR timing

## Verification

```bash
npm test
npm run lint
npm run build
```

The tests cover real PDF extraction, invalid upload handling, the multipart route contract, BM25 search ranking, quoted phrases, Markdown cleanup, page citations, and snippet highlights.

## Privacy boundary

- PDFs and parsed responses persist only in the browser's local IndexedDB storage.
- The source PDF is sent to the local Next.js process for extraction.
- No OpenAI API request is implemented.
- Clearing the library deletes stored browser copies for this origin.
- Deploying the application to a remote server changes the privacy boundary because uploaded files would then reach that server.

## License

[MIT](LICENSE)
