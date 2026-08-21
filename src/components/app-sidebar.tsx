"use client"

import {
  Archive,
  ChevronDown,
  FileText,
  Plus,
  Scale,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const matters = ["Acme renewal", "Vendor agreements", "Property leases"]

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeDocument: string
  onUpload: () => void
  onSelectDocument: (document: string) => void
}

export function AppSidebar({
  activeDocument,
  onUpload,
  onSelectDocument,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <div className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="size-4" strokeWidth={2} />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-tight">Kenzai Legal Vault</p>
            <p className="text-xs text-muted-foreground">Private document workspace</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-5 px-3 py-4">
        <Button
          className="h-9 w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground shadow-none hover:bg-sidebar-primary/90 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          onClick={onUpload}
        >
          <Plus className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Upload document</span>
        </Button>

        <section className="space-y-2 group-data-[collapsible=icon]:hidden">
          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Matters</p>
          <div className="space-y-1">
            {matters.map((matter) => (
              <button
                key={matter}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <span className="truncate">{matter}</span>
                <ChevronDown className="size-3.5 -rotate-90 opacity-50" />
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between px-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Recent</p>
            <Search className="size-3.5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            {["Master Services Agreement.pdf", "NDA - Northstar.pdf", "Lease Addendum.pdf"].map((document) => {
              const isActive = activeDocument === document
              return (
                <button
                  key={document}
                  onClick={() => onSelectDocument(document)}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <FileText className={`mt-0.5 size-4 shrink-0 ${isActive ? "text-emerald-700" : "opacity-70"}`} />
                  <span className="line-clamp-2 leading-5">{document}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-2 group-data-[collapsible=icon]:hidden">
          <p className="px-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Filters</p>
          <button className="flex w-full items-center justify-between rounded-md border border-sidebar-border px-2.5 py-2 text-sm text-muted-foreground">
            Contracts <ChevronDown className="size-3.5" />
          </button>
          <button className="flex w-full items-center justify-between rounded-md border border-sidebar-border px-2.5 py-2 text-sm text-muted-foreground">
            All statuses <ChevronDown className="size-3.5" />
          </button>
        </section>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="space-y-1 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-700" />
            Local-first workspace
          </div>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Settings className="size-4" />
            Workspace settings
          </div>
        </div>
        <div className="hidden group-data-[collapsible=icon]:grid group-data-[collapsible=icon]:place-items-center">
          <Archive className="size-4 text-muted-foreground" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
