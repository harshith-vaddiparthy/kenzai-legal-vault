"use client"

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Plus,
  Scale,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export type SidebarDocument = {
  id: string
  name: string
  status?: "queued" | "processing" | "ready" | "error"
  pageCount?: number
  sizeLabel?: string
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  documents: SidebarDocument[]
  activeDocumentId: string | null
  onUpload: () => void
  onSelectDocument: (documentId: string) => void
  onRemoveDocument?: (documentId: string) => void
  onClearDocuments?: () => void
}

const statusDetails = {
  queued: {
    label: "Queued",
    icon: Clock3,
    iconClassName: "text-amber-600",
  },
  processing: {
    label: "Extracting",
    icon: LoaderCircle,
    iconClassName: "animate-spin text-blue-600",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    iconClassName: "text-emerald-700",
  },
  error: {
    label: "Failed",
    icon: AlertCircle,
    iconClassName: "text-red-600",
  },
} satisfies Record<
  NonNullable<SidebarDocument["status"]>,
  {
    label: string
    icon: typeof FileText
    iconClassName: string
  }
>

function getDocumentMeta(document: SidebarDocument) {
  const metadata = []

  if (document.pageCount !== undefined) {
    metadata.push(`${document.pageCount} ${document.pageCount === 1 ? "page" : "pages"}`)
  }

  if (document.sizeLabel) {
    metadata.push(document.sizeLabel)
  }

  return metadata.join(" · ")
}

export function AppSidebar({
  documents,
  activeDocumentId,
  onUpload,
  onSelectDocument,
  onRemoveDocument,
  onClearDocuments,
  ...props
}: AppSidebarProps) {
  const { isMobile, state } = useSidebar()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Scale className="size-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Kenzai Legal Vault</p>
              <p className="truncate text-xs text-muted-foreground">Private document workspace</p>
            </div>
          </div>
          <SidebarTrigger
            className="size-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-auto"
            title={isMobile ? "Close sidebar" : state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-4 group-data-[collapsible=icon]:px-1.5">
        <Button
          className="h-9 w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground shadow-none hover:bg-sidebar-primary/90 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          onClick={onUpload}
          title="Upload PDF"
        >
          <Plus className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Upload document</span>
        </Button>

        <section className="min-h-0 space-y-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between gap-3 px-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Documents
              </p>
              {documents.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {documents.length} {documents.length === 1 ? "file" : "files"}
                </p>
              ) : null}
            </div>
            {documents.length > 0 && onClearDocuments ? (
              <button
                type="button"
                className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                onClick={onClearDocuments}
              >
                Clear all
              </button>
            ) : null}
          </div>

          {documents.length > 0 ? (
            <div className="space-y-1">
              {documents.map((document) => {
                const isActive = activeDocumentId === document.id
                const documentMeta = getDocumentMeta(document)
                const status = document.status ? statusDetails[document.status] : null
                const StatusIcon = status?.icon

                return (
                  <div
                    key={document.id}
                    className={`group/document flex min-w-0 items-center rounded-md transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDocument(document.id)}
                      className="flex min-w-0 flex-1 items-start gap-2 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring"
                      aria-current={isActive ? "page" : undefined}
                    >
                      <FileText
                        className={`mt-0.5 size-4 shrink-0 ${isActive ? "text-emerald-700" : "opacity-70"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm leading-5">{document.name}</span>
                        {status || documentMeta ? (
                          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] leading-4 opacity-75">
                            {StatusIcon && status ? (
                              <StatusIcon className={`size-3 shrink-0 ${status.iconClassName}`} />
                            ) : null}
                            {status ? <span className="shrink-0">{status.label}</span> : null}
                            {status && documentMeta ? <span aria-hidden="true">·</span> : null}
                            {documentMeta ? <span className="truncate">{documentMeta}</span> : null}
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {onRemoveDocument ? (
                      <button
                        type="button"
                        className="mr-1 grid size-7 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-sidebar-border hover:text-sidebar-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-hover/document:opacity-100"
                        onClick={() => onRemoveDocument(document.id)}
                        aria-label={`Remove ${document.name}`}
                        title={`Remove ${document.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-center">
              <div className="mx-auto grid size-8 place-items-center rounded-full bg-sidebar-accent text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <p className="mt-3 text-sm font-medium text-sidebar-foreground">No documents yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Upload a PDF to extract, inspect, and search it locally.
              </p>
              <Button variant="outline" size="sm" className="mt-3 h-8" onClick={onUpload}>
                Choose PDF
              </Button>
            </div>
          )}
        </section>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
