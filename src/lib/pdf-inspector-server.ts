import {
  classifyPdfAsync,
  extractPagesMarkdownAsync,
  processPdfWithOcr,
  type OcrPdfResult,
  type OcrMode,
  type PageMarkdownResult,
  type PageOcrReasons,
  type PagesExtractionResult,
  type PdfClassification,
} from "@firecrawl/pdf-inspector"

import type {
  PdfConfidenceSource,
  PdfDocumentType,
  PdfInspectionErrorCode,
  PdfInspectionResponse,
  PdfPageInspection,
  PdfPageSource,
} from "@/lib/pdf-inspector-types"

export const MAX_PDF_BYTES = 50 * 1024 * 1024

export interface PdfUploadInput {
  buffer: Buffer
  fileName: string
  mimeType?: string
}

export class PdfInspectionError extends Error {
  constructor(
    public readonly code: PdfInspectionErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "PdfInspectionError"
  }
}

function roundMilliseconds(value: number) {
  return Math.max(0, Math.round(value * 100) / 100)
}

function safeFileName(fileName: string) {
  return fileName.split(/[\\/]/).pop()?.trim() || "document.pdf"
}

function hasPdfSignature(buffer: Buffer) {
  if (buffer.length < 5) return false

  return buffer.subarray(0, Math.min(buffer.length, 1024)).includes("%PDF-")
}

function validatePdfUpload(input: PdfUploadInput) {
  if (input.buffer.length === 0) {
    throw new PdfInspectionError("invalid_pdf", "The selected PDF is empty.", 415)
  }

  if (input.buffer.length > MAX_PDF_BYTES) {
    throw new PdfInspectionError(
      "file_too_large",
      "The PDF exceeds the 50 MB local processing limit.",
      413,
    )
  }

  if (!hasPdfSignature(input.buffer)) {
    throw new PdfInspectionError(
      "invalid_pdf",
      "The selected file does not contain a valid PDF header.",
      415,
    )
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown parser error"
}

function isOcrRuntimeError(error: unknown) {
  const message = errorMessage(error).toLowerCase()

  return [
    "pdfium",
    "onnx",
    "ocr model",
    "model directory",
    "model acquisition",
    "failed to download",
  ].some((needle) => message.includes(needle))
}

function pageReasonsMap(reasons: PageOcrReasons[]) {
  return new Map(reasons.map(({ page, reasons: pageReasons }) => [page, pageReasons]))
}

function pageSource(source: string): PdfPageSource {
  if (source === "Ocr") return "ocr"
  if (source === "Fused") return "fused"
  return "native"
}

function successfulPageResults(
  result: OcrPdfResult,
  documentConfidence: number,
): PdfPageInspection[] {
  const reasons = pageReasonsMap(result.ocrReasonsByPage)

  return result.pages.map(({ pageNumber, markdown, provenance }) => {
    const source = pageSource(provenance.source)
    const hasOcrConfidence = provenance.ocrConfidence != null
    const confidenceSource: PdfConfidenceSource = hasOcrConfidence
      ? "ocr"
      : "document-classification"

    return {
      pageNumber,
      markdown,
      needsOcr: result.pagesRecommendedForOcr.includes(pageNumber),
      ocrReasons: reasons.get(pageNumber) ?? [],
      source,
      confidence: provenance.ocrConfidence ?? documentConfidence,
      confidenceSource,
      hostedRecommended: provenance.hostedRecommended,
      warnings: provenance.warnings,
      timings: provenance.timings,
    }
  })
}

function fallbackPageResults(
  result: PagesExtractionResult,
  documentConfidence: number,
  runtimeMessage: string,
): PdfPageInspection[] {
  const reasons = pageReasonsMap(result.ocrReasonsByPage)

  return result.pages.map((page: PageMarkdownResult) => ({
    pageNumber: page.page + 1,
    markdown: page.markdown,
    needsOcr: page.needsOcr,
    ocrReasons: reasons.get(page.page + 1) ?? (page.ocrReason ? [page.ocrReason] : []),
    source: page.needsOcr ? "unavailable" : "native",
    confidence: page.needsOcr ? null : documentConfidence,
    confidenceSource: page.needsOcr
      ? "unavailable"
      : "document-classification",
    hostedRecommended: page.needsOcr,
    warnings: page.needsOcr ? [runtimeMessage] : [],
    timings: {
      renderMs: 0,
      ocrMs: 0,
      assemblyMs: 0,
    },
  }))
}

function classificationResult(classification: PdfClassification) {
  return {
    pdfType: classification.pdfType as PdfDocumentType,
    pageCount: classification.pageCount,
    confidence: classification.confidence,
  }
}

export async function inspectPdfBuffer(
  input: PdfUploadInput,
): Promise<PdfInspectionResponse> {
  validatePdfUpload(input)

  const startedAt = performance.now()
  let classification: PdfClassification

  try {
    classification = await classifyPdfAsync(input.buffer)
  } catch {
    throw new PdfInspectionError(
      "parse_failed",
      "The PDF could not be classified. It may be corrupt, encrypted, or unsupported.",
      422,
    )
  }

  const ocrRequired = classification.pagesNeedingOcr.length > 0

  try {
    const result = await processPdfWithOcr(input.buffer, {
      mode: "Auto" as OcrMode,
    })
    const hostedPages = result.pagesRecommendingHosted
    const warnings = hostedPages.length
      ? [
          `Pages ${hostedPages.join(", ")} remain low confidence after local OCR and need review.`,
        ]
      : []

    return {
      schemaVersion: 1,
      status: hostedPages.length ? "partial" : "complete",
      document: {
        fileName: safeFileName(input.fileName),
        mimeType: input.mimeType || "application/pdf",
        sizeBytes: input.buffer.length,
      },
      classification: classificationResult(classification),
      pages: successfulPageResults(result, classification.confidence),
      markdown: result.markdown,
      layout: {
        pagesWithTables: result.pagesWithTables,
        pagesWithColumns: result.pagesWithColumns,
        isComplex: result.isComplex,
      },
      ocr: {
        mode: "auto",
        runtimeStatus: ocrRequired ? "ready" : "not-required",
        required: ocrRequired,
        attempted: ocrRequired,
        pagesRecommended: result.pagesRecommendedForOcr,
        pagesRouted: result.pagesRoutedToOcr,
        pagesProcessed: result.pages
          .filter(({ provenance }) => provenance.source !== "Native")
          .map(({ pageNumber }) => pageNumber),
        pagesRecommendingHosted: hostedPages,
        reasonsByPage: result.ocrReasonsByPage,
        message: ocrRequired
          ? "Selective OCR completed locally for the routed pages."
          : "The PDF has a usable text layer, so the OCR runtime was not loaded.",
      },
      timing: {
        totalMs: roundMilliseconds(performance.now() - startedAt),
        parserMs: result.processingTimeMs,
        renderMs: result.renderTimeMs,
        ocrMs: result.ocrTimeMs,
      },
      warnings,
    }
  } catch (error) {
    if (!ocrRequired || !isOcrRuntimeError(error)) {
      throw new PdfInspectionError(
        "parse_failed",
        "The PDF parser could not complete this document.",
        422,
      )
    }

    const fallbackStartedAt = performance.now()
    const nativeResult = await extractPagesMarkdownAsync(input.buffer)
    const parserMs = roundMilliseconds(performance.now() - fallbackStartedAt)
    const runtimeMessage =
      "This page needs OCR, but the local PDFium/ONNX OCR runtime is not configured. Native extraction is shown where available."

    return {
      schemaVersion: 1,
      status: "partial",
      document: {
        fileName: safeFileName(input.fileName),
        mimeType: input.mimeType || "application/pdf",
        sizeBytes: input.buffer.length,
      },
      classification: classificationResult(classification),
      pages: fallbackPageResults(
        nativeResult,
        classification.confidence,
        runtimeMessage,
      ),
      markdown: nativeResult.pages.map(({ markdown }) => markdown).join("\n\n"),
      layout: {
        pagesWithTables: nativeResult.pagesWithTables,
        pagesWithColumns: nativeResult.pagesWithColumns,
        isComplex: nativeResult.isComplex,
      },
      ocr: {
        mode: "auto",
        runtimeStatus: "unavailable",
        required: true,
        attempted: true,
        pagesRecommended: nativeResult.pagesNeedingOcr,
        pagesRouted: [],
        pagesProcessed: [],
        pagesRecommendingHosted: nativeResult.pagesNeedingOcr,
        reasonsByPage: nativeResult.ocrReasonsByPage,
        message: runtimeMessage,
      },
      timing: {
        totalMs: roundMilliseconds(performance.now() - startedAt),
        parserMs,
        renderMs: 0,
        ocrMs: 0,
      },
      warnings: [runtimeMessage],
    }
  }
}
