"use client"

import * as React from "react"
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FolderUp,
  Info,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  PanelLeft,
  Search,
  Table2,
  Upload,
  X,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

type InspectorTab = "markdown" | "raw"

const initialDocument = "Master Services Agreement.pdf"

const parserDetails = {
  markdown: `## 7. Confidentiality

Each party shall keep confidential all Confidential Information disclosed by the other party.

### 7.1 Permitted Disclosure

A receiving party may disclose Confidential Information to its employees, contractors, and professional advisers who need to know it for the purpose of this Agreement.`,
  raw: `7. Confidentiality\nEach party shall keep confidential all Confidential Information disclosed by the other party.\n7.1 Permitted Disclosure\nA receiving party may disclose Confidential Information to its employees, contractors, and professional advisers who need to know it for the purpose of this Agreement.`,
}

export default function LegalVaultDashboard() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [activeDocument, setActiveDocument] = React.useState(initialDocument)
  const [activePage, setActivePage] = React.useState(4)
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>("markdown")
  const [isOpenAiEnabled, setIsOpenAiEnabled] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [askedQuery, setAskedQuery] = React.useState("")
  const [uploadedPdfUrl, setUploadedPdfUrl] = React.useState<string | null>(null)
  const [uploadState, setUploadState] = React.useState<"idle" | "ready" | "error">("idle")

  React.useEffect(() => {
    return () => {
      if (uploadedPdfUrl) URL.revokeObjectURL(uploadedPdfUrl)
    }
  }, [uploadedPdfUrl])

  function openFilePicker() {
    inputRef.current?.click()
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      setUploadState("error")
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setUploadedPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })
    setActiveDocument(file.name)
    setActivePage(1)
    setUploadState("ready")
    event.target.value = ""
  }

  function handleAsk() {
    const cleaned = query.trim()
    if (cleaned) setAskedQuery(cleaned)
  }

  const isUploadedDocument = activeDocument !== initialDocument && uploadState === "ready"

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar activeDocument={activeDocument} onUpload={openFilePicker} onSelectDocument={setActiveDocument} />
      <SidebarInset className="min-w-0 bg-stone-50">
        <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={handleUpload} />

        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="text-stone-500 hover:bg-stone-100 md:hidden" />
            <PanelLeft className="hidden size-4 text-stone-500 md:block" />
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            <div className="min-w-0">
              <p className="text-xs text-stone-500">Matter workspace</p>
              <h1 className="truncate text-sm font-semibold text-stone-900">Acme renewal</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="hidden items-center gap-1.5 sm:flex"><LockKeyhole className="size-3.5 text-emerald-700" /> Local mode</span>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-stone-200 bg-white text-stone-700" onClick={openFilePicker}>
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Upload PDF</span>
            </Button>
          </div>
        </header>

        <main className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_23rem]">
          <section className="min-w-0 border-b border-stone-200 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{activeDocument}</p>
                <p className="mt-0.5 text-xs text-stone-500">Source PDF · page {activePage} of {isUploadedDocument ? "?" : "18"}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-8 text-stone-500" aria-label="Document options">
                <ListFilter className="size-4" />
              </Button>
            </div>

            <div className="bg-stone-100 p-4 md:p-6">
              <div className="mx-auto min-h-[31rem] max-w-3xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                {uploadedPdfUrl ? (
                  <iframe title={`Preview of ${activeDocument}`} src={uploadedPdfUrl} className="h-[42rem] w-full bg-white" />
                ) : (
                  <article className="mx-auto max-w-2xl px-8 py-12 text-stone-800 md:px-16">
                    <div className="mb-10 flex items-start justify-between border-b border-stone-200 pb-5 text-xs text-stone-500">
                      <span>MASTER SERVICES AGREEMENT</span>
                      <span>Page {activePage}</span>
                    </div>
                    <p className="mb-8 text-xs font-semibold tracking-[0.16em] text-stone-400">7. CONFIDENTIALITY</p>
                    <h2 className="mb-5 text-2xl font-semibold tracking-tight text-stone-950">Confidential Information</h2>
                    <p className="mb-5 leading-7">
                      Each party shall keep confidential all Confidential Information disclosed by the other party. The receiving party shall use the same degree of care that it uses to protect its own confidential information.
                    </p>
                    <div className="my-8 border-l-2 border-emerald-700 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
                      <p className="font-semibold">Selected source text</p>
                      <p className="mt-1">This area links directly to the extracted clause in the parser inspector.</p>
                    </div>
                    <h3 className="mb-3 text-lg font-semibold text-stone-950">7.1 Permitted Disclosure</h3>
                    <p className="leading-7">
                      A receiving party may disclose Confidential Information to employees, contractors, and professional advisers who need to know it for the purpose of this Agreement.
                    </p>
                  </article>
                )}
              </div>
            </div>

            <div className="border-t border-stone-200 bg-white px-4 py-3 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-8 border-stone-200" onClick={() => setActivePage((page) => Math.max(1, page - 1))} aria-label="Previous page">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <div className="mx-1 flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((page) => (
                      <button key={page} onClick={() => setActivePage(page)} className={`grid size-8 place-items-center rounded-md text-xs transition-colors ${activePage === page ? "bg-stone-900 font-medium text-white" : "text-stone-500 hover:bg-stone-100"}`}>
                        {page}
                      </button>
                    ))}
                    <span className="px-1 text-stone-400">…</span>
                    <button onClick={() => setActivePage(18)} className="grid size-8 place-items-center rounded-md text-xs text-stone-500 hover:bg-stone-100">18</button>
                  </div>
                  <Button variant="outline" size="icon" className="size-8 border-stone-200" onClick={() => setActivePage((page) => Math.min(isUploadedDocument ? page + 1 : 18, page + 1))} aria-label="Next page">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <FolderUp className="size-3.5" />
                  {uploadState === "ready" ? "Local preview loaded" : uploadState === "error" ? "Please choose a PDF file" : "Upload a PDF to preview it here"}
                </div>
              </div>
            </div>
          </section>

          <aside className="bg-white xl:min-h-0">
            <div className="border-b border-stone-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">Parser inspector</p>
                  <p className="mt-0.5 text-xs text-stone-500">Extraction and source quality</p>
                </div>
                <Info className="size-4 text-stone-400" />
              </div>
            </div>

            <div className="space-y-5 p-5">
              <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-900">Extraction status</p>
                    <p className="mt-1 text-xs text-stone-500">{isUploadedDocument ? "Awaiting parser integration" : "Native text recovered"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${isUploadedDocument ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{isUploadedDocument ? "Preview only" : "Ready"}</span>
                </div>
                <div className="mt-4 space-y-2.5 text-xs text-stone-600">
                  {isUploadedDocument ? (
                    <p className="flex items-center gap-2"><LoaderCircle className="size-3.5 text-amber-700" /> Connect pdf-inspector to extract this file</p>
                  ) : (
                    <>
                      <p className="flex items-center gap-2"><Check className="size-3.5 text-emerald-700" /> Reading order verified</p>
                      <p className="flex items-center gap-2"><Check className="size-3.5 text-emerald-700" /> No OCR required</p>
                      <p className="flex items-center gap-2"><Check className="size-3.5 text-emerald-700" /> Headings and clause structure found</p>
                    </>
                  )}
                  <p className="flex items-center gap-2"><ClipboardCheck className="size-3.5 text-stone-500" /> Confidence: {isUploadedDocument ? "Not yet assessed" : "98%"}</p>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Output</p>
                  <div className="flex rounded-md bg-stone-100 p-0.5 text-xs">
                    {(["markdown", "raw"] as InspectorTab[]).map((tab) => (
                      <button key={tab} onClick={() => setInspectorTab(tab)} className={`rounded px-2 py-1 capitalize transition-colors ${inspectorTab === tab ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-500"}`}>{tab === "markdown" ? "Clean Markdown" : "Raw text"}</button>
                    ))}
                  </div>
                </div>
                <pre className="max-h-56 overflow-auto rounded-lg border border-stone-200 bg-stone-950 p-4 font-mono text-xs leading-5 whitespace-pre-wrap text-stone-200">{isUploadedDocument ? "Upload preview is ready.\n\nThe local parser has not been connected yet, so no text is being claimed as extracted." : parserDetails[inspectorTab]}</pre>
              </section>

              <section className="rounded-lg border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-stone-700" />
                    <span className="text-sm font-medium text-stone-900">OpenAI analysis</span>
                  </div>
                  <button onClick={() => setIsOpenAiEnabled((enabled) => !enabled)} className={`relative h-5 w-9 rounded-full transition-colors ${isOpenAiEnabled ? "bg-emerald-700" : "bg-stone-200"}`} aria-pressed={isOpenAiEnabled} aria-label="Toggle OpenAI analysis">
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${isOpenAiEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">{isOpenAiEnabled ? "Enabled for this session. Only selected retrieved excerpts should be sent when analysis is connected." : "Off. Documents and extraction remain local."}</p>
              </section>
            </div>
          </aside>
        </main>

        <section className="border-t border-stone-200 bg-white px-4 py-4 md:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900"><MessageSquareText className="size-4" /> Search and analyse</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleAsk() }} placeholder="What is the termination notice period and are there exceptions?" className="h-10 border-stone-200 pl-9 text-sm shadow-none focus-visible:ring-emerald-700" />
              </div>
              <Button onClick={handleAsk} className="h-10 bg-stone-900 text-white hover:bg-stone-800">Ask document</Button>
            </div>
            {askedQuery ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950">
                <Table2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                <p><span className="font-medium">Ready for retrieval:</span> “{askedQuery}” will search locally first. Model analysis is {isOpenAiEnabled ? "enabled for approved excerpts." : "off."}</p>
                <button onClick={() => setAskedQuery("")} className="ml-auto text-emerald-800" aria-label="Dismiss message"><X className="size-4" /></button>
              </div>
            ) : null}
          </div>
        </section>
      </SidebarInset>
    </SidebarProvider>
  )
}
