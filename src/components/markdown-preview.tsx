"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

type MarkdownPreviewProps = {
  markdown: string
  className?: string
}

export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  if (!markdown.trim()) {
    return (
      <div className={cn("grid min-h-48 place-items-center text-sm text-stone-500", className)}>
        No text was recovered from this page.
      </div>
    )
  }

  return (
    <div className={cn("legal-markdown text-sm leading-7 text-stone-700", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-5 mt-8 text-2xl font-semibold tracking-tight text-stone-950 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-4 mt-7 text-xl font-semibold tracking-tight text-stone-950 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-3 mt-6 text-base font-semibold text-stone-950 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-5 text-sm font-semibold text-stone-900 first:mt-0">{children}</h4>,
          h5: ({ children }) => <h5 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-stone-600 first:mt-0">{children}</h5>,
          p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-emerald-700 bg-emerald-50 px-4 py-2 text-emerald-950">{children}</blockquote>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-emerald-800 underline underline-offset-4">{children}</a>,
          table: ({ children }) => <div className="my-4 overflow-x-auto rounded-lg border border-stone-200"><table className="w-full min-w-max border-collapse text-left text-xs">{children}</table></div>,
          th: ({ children }) => <th className="border-b border-r border-stone-200 bg-stone-100 px-3 py-2 font-semibold text-stone-900 last:border-r-0">{children}</th>,
          td: ({ children }) => <td className="border-b border-r border-stone-100 px-3 py-2 align-top last:border-r-0">{children}</td>,
          code: ({ className: codeClassName, children }) => {
            const isBlock = Boolean(codeClassName)
            return isBlock ? (
              <code className="block overflow-x-auto rounded-md bg-stone-950 p-4 font-mono text-xs text-stone-100">{children}</code>
            ) : (
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs text-stone-800">{children}</code>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
