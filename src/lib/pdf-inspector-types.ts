export type PdfDocumentType =
  | "TextBased"
  | "Scanned"
  | "Mixed"
  | "ImageBased"

export type PdfInspectionStatus = "complete" | "partial"

export type PdfPageSource = "native" | "ocr" | "fused" | "unavailable"

export type PdfConfidenceSource =
  | "document-classification"
  | "ocr"
  | "unavailable"

export type OcrRuntimeStatus =
  | "not-required"
  | "ready"
  | "unavailable"
  | "failed"

export interface PdfPageTiming {
  renderMs: number
  ocrMs: number
  assemblyMs: number
}

export interface PdfPageInspection {
  pageNumber: number
  markdown: string
  needsOcr: boolean
  ocrReasons: string[]
  source: PdfPageSource
  confidence: number | null
  confidenceSource: PdfConfidenceSource
  hostedRecommended: boolean
  warnings: string[]
  timings: PdfPageTiming
}

export interface PdfInspectionResponse {
  schemaVersion: 1
  status: PdfInspectionStatus
  document: {
    fileName: string
    mimeType: string
    sizeBytes: number
  }
  classification: {
    pdfType: PdfDocumentType
    pageCount: number
    confidence: number
  }
  pages: PdfPageInspection[]
  markdown: string
  layout: {
    pagesWithTables: number[]
    pagesWithColumns: number[]
    isComplex: boolean
  }
  ocr: {
    mode: "auto"
    runtimeStatus: OcrRuntimeStatus
    required: boolean
    attempted: boolean
    pagesRecommended: number[]
    pagesRouted: number[]
    pagesProcessed: number[]
    pagesRecommendingHosted: number[]
    reasonsByPage: Array<{
      page: number
      reasons: string[]
    }>
    message: string
  }
  timing: {
    totalMs: number
    parserMs: number
    renderMs: number
    ocrMs: number
  }
  warnings: string[]
}

export type PdfInspectionErrorCode =
  | "invalid_request"
  | "missing_file"
  | "file_too_large"
  | "invalid_pdf"
  | "parse_failed"

export interface PdfInspectionErrorResponse {
  error: {
    code: PdfInspectionErrorCode
    message: string
  }
}
