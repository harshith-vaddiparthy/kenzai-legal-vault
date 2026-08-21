import {
  PdfInspectionError,
  inspectPdfBuffer,
} from "@/lib/pdf-inspector-server"
import type { PdfInspectionErrorResponse } from "@/lib/pdf-inspector-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function errorResponse(
  code: PdfInspectionErrorResponse["error"]["code"],
  message: string,
  status: number,
) {
  return Response.json(
    { error: { code, message } } satisfies PdfInspectionErrorResponse,
    { status },
  )
}

export async function POST(request: Request) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return errorResponse(
      "invalid_request",
      "Send the PDF as multipart form data using the file field.",
      400,
    )
  }

  const upload = formData.get("file")

  if (!upload || typeof upload === "string") {
    return errorResponse("missing_file", "Choose a PDF file to inspect.", 400)
  }

  try {
    const result = await inspectPdfBuffer({
      buffer: Buffer.from(await upload.arrayBuffer()),
      fileName: upload.name,
      mimeType: upload.type,
    })

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof PdfInspectionError) {
      return errorResponse(error.code, error.message, error.status)
    }

    return errorResponse(
      "parse_failed",
      "The PDF parser failed unexpectedly. The document was not stored.",
      500,
    )
  }
}
