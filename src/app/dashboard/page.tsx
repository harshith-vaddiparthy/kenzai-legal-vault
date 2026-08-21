"use client"

import * as React from "react"
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSearch,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  UploadCloud,
  X,
} from "lucide-react"

import { AppSidebar, type SidebarDocument } from "@/components/app-sidebar"
import { MarkdownPreview } from "@/components/markdown-preview"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  clearStoredPdfDocuments,
  listStoredPdfDocuments,
  removeStoredPdfDocument,
  saveStoredPdfDocument,
} from "@/lib/document-store"
import {
  createLocalSearchIndex,
  type LocalSearchResponse,
  type SearchHighlight,
} from "@/lib/local-search"
import type {
  PdfInspectionErrorResponse,
  PdfInspectionResponse,
} from "@/lib/pdf-inspector-types"
import { cn } from "@/lib/utils"

type InspectorTab = "preview" | "markdown" | "diagnostics"
type LibraryState = "loading" | "ready" | "error"

type LocalPdfDocument = {
  id: string
  name: string
  size: number
  type: string
  lastModified: number
  uploadedAt: number
  file: File
  objectUrl: string
  status: NonNullable<SidebarDocument["status"]>
  inspection?: PdfInspectionResponse
  error?: string
}

const MAX_PDF_BYTES = 50 * 1024 * 1024

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatPdfType(type: string) {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2")
}

function formatPercent(value: number | null) {
  return value === null ? "Unavailable" : `${Math.round(value * 100)}%`
}

function isPdfInspectionResponse(value: unknown): value is PdfInspectionResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<PdfInspectionResponse>
  return candidate.schemaVersion === 1 && Array.isArray(candidate.pages)
}

function pageNavigation(pageCount: number, currentPage: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const pages = new Set([
    1,
    2,
    Math.max(1, currentPage - 1),
    currentPage,
    Math.min(pageCount, currentPage + 1),
    pageCount - 1,
    pageCount,
  ])

  return [...pages].sort((first, second) => first - second)
}

function HighlightedText({ text, highlights }: { text: string; highlights: SearchHighlight[] }) {
  if (!highlights.length) return text

  const segments: React.ReactNode[] = []
  let cursor = 0

  highlights.forEach((highlight, index) => {
    if (highlight.start > cursor) segments.push(text.slice(cursor, highlight.start))
    segments.push(
      <mark key={`${highlight.start}-${index}`} className="rounded-sm bg-amber-100 px-0.5 text-amber-950">
        {text.slice(highlight.start, highlight.end)}
      </mark>,
    )
    cursor = highlight.end
  })

  if (cursor < text.length) segments.push(text.slice(cursor))
  return segments
}

export default function LegalVaultDashboard() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const objectUrlsRef = React.useRef(new Set<string>())
  const removedDocumentIdsRef = React.useRef(new Set<string>())

  const [documents, setDocuments] = React.useState<LocalPdfDocument[]>([])
  const [activeDocumentId, setActiveDocumentId] = React.useState<string | null>(null)
  const [activePage, setActivePage] = React.useState(1)
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>("preview")
  const [libraryState, setLibraryState] = React.useState<LibraryState>("loading")
  const [isDragging, setIsDragging] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [searchResponse, setSearchResponse] = React.useState<LocalSearchResponse | null>(null)

  const activeDocument = React.useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? null,
    [activeDocumentId, documents],
  )
  const inspection = activeDocument?.inspection
  const currentPage = inspection?.pages.find((page) => page.pageNumber === activePage) ?? null
  const searchIndex = React.useMemo(
    () =>
      inspection
        ? createLocalSearchIndex(
            inspection.pages.map((page) => ({
              pageNumber: page.pageNumber,
              markdown: page.markdown,
            })),
          )
        : null,
    [inspection],
  )

  const inspectDocument = React.useCallback(async (document: LocalPdfDocument) => {
    setDocuments((current) =>
      current.map((entry) =>
        entry.id === document.id
          ? { ...entry, status: "processing", error: undefined }
          : entry,
      ),
    )

    const body = new FormData()
    body.set("file", document.file)

    let payload: PdfInspectionResponse

    try {
      const response = await fetch("/api/pdf/inspect", {
        method: "POST",
        body,
      })
      const responsePayload = (await response.json()) as
        | PdfInspectionResponse
        | PdfInspectionErrorResponse

      if (!response.ok || "error" in responsePayload) {
        throw new Error(
          "error" in responsePayload
            ? responsePayload.error.message
            : "The local PDF parser did not return a valid result.",
        )
      }

      payload = responsePayload
    } catch (error) {
      if (removedDocumentIdsRef.current.has(document.id)) return
      const message = error instanceof Error ? error.message : "The PDF could not be inspected."
      setDocuments((current) =>
        current.map((entry) =>
          entry.id === document.id ? { ...entry, status: "error", error: message } : entry,
        ),
      )
      setNotice(message)
      return
    }

    if (removedDocumentIdsRef.current.has(document.id)) return

    const updatedDocument: LocalPdfDocument = {
      ...document,
      status: "ready",
      inspection: payload,
      error: undefined,
    }

    setDocuments((current) =>
      current.map((entry) => (entry.id === document.id ? updatedDocument : entry)),
    )

    try {
      await saveStoredPdfDocument({
        id: updatedDocument.id,
        name: updatedDocument.name,
        size: updatedDocument.size,
        type: updatedDocument.type,
        lastModified: updatedDocument.lastModified,
        uploadedAt: updatedDocument.uploadedAt,
        file: updatedDocument.file,
        inspection: payload,
      })
    } catch {
      if (!removedDocumentIdsRef.current.has(document.id)) {
        setLibraryState("error")
        setNotice(
          "Extraction completed, but this browser could not persist the result. The document remains available for this session.",
        )
      }
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const objectUrls = objectUrlsRef.current

    void (async () => {
      try {
        const storedDocuments = await listStoredPdfDocuments()
        if (cancelled) return

        const hydratedDocuments = storedDocuments.map<LocalPdfDocument>((stored) => {
          const file = new File([stored.file], stored.name, {
            type: stored.type || "application/pdf",
            lastModified: stored.lastModified,
          })
          const objectUrl = URL.createObjectURL(file)
          objectUrls.add(objectUrl)
          const storedInspection = isPdfInspectionResponse(stored.inspection)
            ? stored.inspection
            : undefined

          return {
            id: stored.id,
            name: stored.name,
            size: stored.size,
            type: stored.type,
            lastModified: stored.lastModified,
            uploadedAt: stored.uploadedAt,
            file,
            objectUrl,
            status: storedInspection ? "ready" : "queued",
            inspection: storedInspection,
          }
        })

        setDocuments(hydratedDocuments)
        setActiveDocumentId(hydratedDocuments[0]?.id ?? null)
        setLibraryState("ready")

        hydratedDocuments
          .filter((document) => !document.inspection)
          .forEach((document) => void inspectDocument(document))
      } catch {
        if (!cancelled) {
          setLibraryState("error")
          setNotice("The browser could not open the local document library.")
        }
      }
    })()

    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [inspectDocument])

  function openFilePicker() {
    inputRef.current?.click()
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    )

    if (!pdfFiles.length) {
      setNotice("Choose a PDF file. Other file types are not accepted.")
      return
    }

    const oversized = pdfFiles.find((file) => file.size > MAX_PDF_BYTES)
    if (oversized) {
      setNotice(`${oversized.name} exceeds the 50 MB local processing limit.`)
      return
    }

    setNotice(null)

    for (const file of pdfFiles) {
      const objectUrl = URL.createObjectURL(file)
      objectUrlsRef.current.add(objectUrl)
      const document: LocalPdfDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || "application/pdf",
        lastModified: file.lastModified,
        uploadedAt: Date.now(),
        file,
        objectUrl,
        status: "queued",
      }

      setDocuments((current) => [document, ...current])
      setActiveDocumentId(document.id)
      setActivePage(1)
      setInspectorTab("preview")
      setSearchResponse(null)
      setQuery("")

      try {
        await saveStoredPdfDocument({
          id: document.id,
          name: document.name,
          size: document.size,
          type: document.type,
          lastModified: document.lastModified,
          uploadedAt: document.uploadedAt,
          file: document.file,
        })
      } catch {
        setLibraryState("error")
        setNotice(
          "This browser could not persist the PDF. It remains available for this session and will still be inspected.",
        )
      }
      void inspectDocument(document)
    }
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) void addFiles(event.target.files)
    event.target.value = ""
  }

  function selectDocument(id: string) {
    setActiveDocumentId(id)
    setActivePage(1)
    setInspectorTab("preview")
    setSearchResponse(null)
    setQuery("")
    setNotice(null)
  }

  async function removeDocument(id: string) {
    const document = documents.find((entry) => entry.id === id)
    if (!document || !window.confirm(`Remove ${document.name} from this local browser?`)) return

    removedDocumentIdsRef.current.add(id)
    URL.revokeObjectURL(document.objectUrl)
    objectUrlsRef.current.delete(document.objectUrl)
    const remainingDocuments = documents.filter((entry) => entry.id !== id)
    setDocuments(remainingDocuments)
    if (activeDocumentId === id) {
      setActiveDocumentId(remainingDocuments[0]?.id ?? null)
      setActivePage(1)
      setSearchResponse(null)
    }
    try {
      await removeStoredPdfDocument(id)
    } catch {
      setLibraryState("error")
      setNotice(
        "The document was removed from this session, but browser storage could not be updated.",
      )
    }
  }

  async function clearDocuments() {
    if (!documents.length || !window.confirm("Remove every PDF from this local browser?")) return

    documents.forEach((document) => {
      removedDocumentIdsRef.current.add(document.id)
      URL.revokeObjectURL(document.objectUrl)
      objectUrlsRef.current.delete(document.objectUrl)
    })
    setDocuments([])
    setActiveDocumentId(null)
    setActivePage(1)
    setSearchResponse(null)
    try {
      await clearStoredPdfDocuments()
    } catch {
      setLibraryState("error")
      setNotice(
        "The documents were cleared from this session, but browser storage could not be updated.",
      )
    }
  }

  function runSearch() {
    if (!searchIndex || !query.trim()) return
    setSearchResponse(searchIndex.search(query, { limit: 8, maxResultsPerPage: 2 }))
  }

  const sidebarDocuments: SidebarDocument[] = documents.map((document) => ({
    id: document.id,
    name: document.name,
    status: document.status,
    pageCount: document.inspection?.classification.pageCount,
    sizeLabel: formatBytes(document.size),
  }))

  const pageNumbers = inspection
    ? pageNavigation(inspection.classification.pageCount, activePage)
    : []

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        documents={sidebarDocuments}
        activeDocumentId={activeDocumentId}
        onUpload={openFilePicker}
        onSelectDocument={selectDocument}
        onRemoveDocument={(id) => void removeDocument(id)}
        onClearDocuments={() => void clearDocuments()}
      />
      <SidebarInset className="min-w-0 bg-stone-50">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleUpload}
        />

        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="text-stone-500 hover:bg-stone-100 md:hidden" />
            <div className="min-w-0">
              <p className="text-xs text-stone-500">Document workspace</p>
              <h1 className="max-w-[56vw] truncate text-sm font-semibold text-stone-900">
                {activeDocument?.name ?? "No document selected"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="hidden items-center gap-1.5 sm:flex">
              <LockKeyhole className="size-3.5 text-emerald-700" /> Stored in this browser
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stone-200 bg-white text-stone-700"
              onClick={openFilePicker}
            >
              <UploadCloud className="size-3.5" />
              <span className="hidden sm:inline">Upload PDF</span>
            </Button>
          </div>
        </header>

        {notice ? (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 md:px-6" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>{notice}</span>
            <button className="ml-auto rounded p-0.5 hover:bg-amber-100" onClick={() => setNotice(null)} aria-label="Dismiss notice">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {activeDocument ? (
          <>
            <main className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_25rem]">
              <section className="min-w-0 border-b border-stone-200 xl:border-b-0 xl:border-r">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-900">{activeDocument.name}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {inspection
                        ? `Page ${activePage} of ${inspection.classification.pageCount} · ${formatBytes(activeDocument.size)}`
                        : `${formatBytes(activeDocument.size)} · ${activeDocument.status === "error" ? "Extraction failed" : "Extracting locally"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-stone-200"
                      onClick={() => void inspectDocument(activeDocument)}
                      disabled={activeDocument.status === "processing"}
                    >
                      <RefreshCw className={cn("size-3.5", activeDocument.status === "processing" && "animate-spin")} />
                      Re-run
                    </Button>
                    <a
                      href={activeDocument.objectUrl}
                      download={activeDocument.name}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 border-stone-200")}
                    >
                      <Download className="size-3.5" /> Download
                    </a>
                  </div>
                </div>

                <div className="bg-stone-100 p-3 md:p-5">
                  <div className="mx-auto h-[44rem] max-w-4xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                    <iframe
                      key={`${activeDocument.id}-${activePage}`}
                      title={`Source PDF: ${activeDocument.name}`}
                      src={`${activeDocument.objectUrl}#page=${activePage}&zoom=page-width`}
                      className="h-full w-full bg-white"
                    />
                  </div>
                </div>

                {inspection ? (
                  <div className="border-t border-stone-200 bg-white px-4 py-3 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 border-stone-200"
                          onClick={() => setActivePage((page) => Math.max(1, page - 1))}
                          disabled={activePage === 1}
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <div className="mx-1 flex items-center gap-1">
                          {pageNumbers.map((page, index) => {
                            const priorPage = pageNumbers[index - 1]
                            return (
                              <React.Fragment key={page}>
                                {priorPage && page - priorPage > 1 ? <span className="px-1 text-stone-400">…</span> : null}
                                <button
                                  onClick={() => setActivePage(page)}
                                  className={cn(
                                    "grid size-8 place-items-center rounded-md text-xs transition-colors",
                                    activePage === page
                                      ? "bg-stone-900 font-medium text-white"
                                      : "text-stone-500 hover:bg-stone-100",
                                  )}
                                  aria-current={activePage === page ? "page" : undefined}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            )
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 border-stone-200"
                          onClick={() =>
                            setActivePage((page) => Math.min(inspection.classification.pageCount, page + 1))
                          }
                          disabled={activePage === inspection.classification.pageCount}
                          aria-label="Next page"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-stone-500">
                        Source: {currentPage?.source ?? "unavailable"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>

              <aside className="min-w-0 bg-white">
                <div className="border-b border-stone-200 px-5 py-4">
                  <p className="text-sm font-semibold text-stone-900">Parser inspector</p>
                  <p className="mt-0.5 text-xs text-stone-500">Real Firecrawl extraction data</p>
                </div>

                <div className="space-y-5 p-5">
                  {activeDocument.status === "processing" || activeDocument.status === "queued" ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4" role="status" aria-live="polite">
                      <div className="flex items-center gap-2 text-sm font-medium text-blue-950">
                        <LoaderCircle className="size-4 animate-spin text-blue-700" /> Inspecting PDF locally
                      </div>
                      <p className="mt-2 text-xs leading-5 text-blue-800">
                        Classifying pages, extracting layout, and routing scanned pages through OCR.
                      </p>
                    </div>
                  ) : activeDocument.status === "error" ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
                      <div className="flex items-center gap-2 text-sm font-medium text-red-950">
                        <AlertTriangle className="size-4 text-red-700" /> Extraction failed
                      </div>
                      <p className="mt-2 text-xs leading-5 text-red-800">{activeDocument.error}</p>
                    </div>
                  ) : inspection ? (
                    <>
                      <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-stone-900">Extraction status</p>
                            <p className="mt-1 text-xs text-stone-500">{inspection.ocr.message}</p>
                          </div>
                          <span className={cn(
                            "rounded-full px-2 py-1 text-[11px] font-medium",
                            inspection.status === "complete"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800",
                          )}>
                            {inspection.status === "complete" ? "Complete" : "Review needed"}
                          </span>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div>
                            <dt className="text-stone-500">PDF type</dt>
                            <dd className="mt-0.5 font-medium text-stone-900">{formatPdfType(inspection.classification.pdfType)}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Confidence</dt>
                            <dd className="mt-0.5 font-medium text-stone-900">{formatPercent(inspection.classification.confidence)}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Pages</dt>
                            <dd className="mt-0.5 font-medium text-stone-900">{inspection.classification.pageCount}</dd>
                          </div>
                          <div>
                            <dt className="text-stone-500">Processing</dt>
                            <dd className="mt-0.5 font-medium text-stone-900">{Math.round(inspection.timing.totalMs)} ms</dd>
                          </div>
                        </dl>
                        <div className="mt-4 space-y-2 text-xs text-stone-600">
                          <p className="flex items-center gap-2">
                            <ShieldCheck className="size-3.5 text-emerald-700" />
                            {inspection.ocr.pagesProcessed.length
                              ? `${inspection.ocr.pagesProcessed.length} page(s) processed by local OCR`
                              : "No OCR required"}
                          </p>
                          <p className="flex items-center gap-2">
                            <Table2 className="size-3.5 text-stone-500" />
                            Tables on {inspection.layout.pagesWithTables.length} page(s)
                          </p>
                          <p className="flex items-center gap-2">
                            <Columns3 className="size-3.5 text-stone-500" />
                            Columns on {inspection.layout.pagesWithColumns.length} page(s)
                          </p>
                        </div>
                      </section>

                      {currentPage ? (
                        <section>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Page {currentPage.pageNumber} output</p>
                              <p className="mt-1 text-[11px] text-stone-500">
                                {currentPage.source} source · {formatPercent(currentPage.confidence)} confidence
                              </p>
                            </div>
                            <div className="flex rounded-md bg-stone-100 p-0.5 text-xs">
                              {(["preview", "markdown", "diagnostics"] as InspectorTab[]).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setInspectorTab(tab)}
                                  className={cn(
                                    "rounded px-2 py-1 capitalize transition-colors",
                                    inspectorTab === tab
                                      ? "bg-white font-medium text-stone-900 shadow-sm"
                                      : "text-stone-500",
                                  )}
                                >
                                  {tab}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="max-h-[32rem] overflow-auto rounded-lg border border-stone-200 bg-white">
                            {inspectorTab === "preview" ? (
                              <MarkdownPreview markdown={currentPage.markdown} className="p-4" />
                            ) : inspectorTab === "markdown" ? (
                              <pre className="min-h-48 whitespace-pre-wrap bg-stone-950 p-4 font-mono text-xs leading-5 text-stone-200">
                                {currentPage.markdown || "No Markdown was recovered from this page."}
                              </pre>
                            ) : (
                              <pre className="min-h-48 whitespace-pre-wrap bg-stone-950 p-4 font-mono text-xs leading-5 text-stone-200">
                                {JSON.stringify(
                                  {
                                    pageNumber: currentPage.pageNumber,
                                    source: currentPage.source,
                                    needsOcr: currentPage.needsOcr,
                                    ocrReasons: currentPage.ocrReasons,
                                    confidence: currentPage.confidence,
                                    confidenceSource: currentPage.confidenceSource,
                                    hostedRecommended: currentPage.hostedRecommended,
                                    warnings: currentPage.warnings,
                                    timings: currentPage.timings,
                                  },
                                  null,
                                  2,
                                )}
                              </pre>
                            )}
                          </div>
                        </section>
                      ) : null}

                      {inspection.warnings.length ? (
                        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                          <p className="font-medium">Review notes</p>
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            {inspection.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                          </ul>
                        </section>
                      ) : null}
                    </>
                  ) : null}

                  <section className="rounded-lg border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Bot className="size-4 text-stone-500" />
                        <span className="text-sm font-medium text-stone-900">OpenAI analysis</span>
                      </div>
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">Not connected</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      No document text is sent to OpenAI. Add an API key and an explicit sharing policy before enabling model analysis.
                    </p>
                  </section>
                </div>
              </aside>
            </main>

            <section className="border-t border-stone-200 bg-white px-4 py-5 md:px-6">
              <div className="mx-auto max-w-6xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      <Search className="size-4" /> Search extracted text
                    </div>
                    <p className="mt-1 text-xs text-stone-500">Ranked locally with page-level citations. No external model is used.</p>
                  </div>
                  {searchResponse ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSearchResponse(null); setQuery("") }}>
                      Clear results
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") runSearch() }}
                      placeholder="Search clauses, terms, obligations, dates, or parties"
                      className="h-10 border-stone-200 pl-9 text-sm shadow-none focus-visible:ring-emerald-700"
                      disabled={!inspection}
                    />
                  </div>
                  <Button
                    onClick={runSearch}
                    className="h-10 bg-stone-900 text-white hover:bg-stone-800"
                    disabled={!inspection || !query.trim()}
                  >
                    Search document
                  </Button>
                </div>

                {searchResponse ? (
                  <div className="mt-4">
                    <p className="mb-3 text-xs text-stone-500">
                      {searchResponse.results.length
                        ? `${searchResponse.results.length} ranked result(s) across ${searchResponse.searchedPages} searchable page(s)`
                        : `No matches found across ${searchResponse.searchedPages} searchable page(s)`}
                    </p>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {searchResponse.results.map((result) => (
                        <button
                          key={result.id}
                          className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                          onClick={() => {
                            setActivePage(result.pageNumber)
                            setInspectorTab("preview")
                            window.scrollTo({ top: 0, behavior: "smooth" })
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-emerald-800">{result.citation}</span>
                            <span className="text-[11px] text-stone-500">{Math.round(result.score * 100)}% relevance</span>
                          </div>
                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-stone-700">
                            <HighlightedText text={result.snippet} highlights={result.highlights} />
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : (
          <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-4 md:p-8">
            <section
              className={cn(
                "w-full max-w-2xl rounded-2xl border-2 border-dashed bg-white px-6 py-16 text-center transition-colors md:px-12",
                isDragging ? "border-emerald-600 bg-emerald-50" : "border-stone-300",
              )}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={(event) => { event.preventDefault(); setIsDragging(false) }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files)
              }}
            >
              {libraryState === "loading" ? (
                <>
                  <LoaderCircle className="mx-auto size-7 animate-spin text-stone-500" />
                  <h2 className="mt-4 text-lg font-semibold text-stone-950">Opening your local library</h2>
                </>
              ) : (
                <>
                  <div className="mx-auto grid size-12 place-items-center rounded-xl bg-stone-100 text-stone-700">
                    <FileSearch className="size-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight text-stone-950">Upload a PDF to begin</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
                    The file stays in this browser. Firecrawl PDF Inspector extracts native text and runs local OCR only when a page needs it.
                  </p>
                  <Button onClick={openFilePicker} className="mt-6 h-10 gap-2 bg-stone-900 px-4 text-white hover:bg-stone-800">
                    <UploadCloud className="size-4" /> Choose PDF
                  </Button>
                  <p className="mt-3 text-xs text-stone-500">or drop one or more PDFs here · 50 MB maximum per file</p>
                  {libraryState === "error" ? (
                    <p className="mt-4 text-sm text-red-700">Local persistence is unavailable, but you can still upload documents for this session.</p>
                  ) : null}
                </>
              )}
            </section>
          </main>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
