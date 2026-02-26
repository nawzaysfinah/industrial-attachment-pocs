import { extractTextFromBuffer, saveUploadedFile } from "@/lib/extract";
import { jsonError } from "@/lib/http";
import { textPreview } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return jsonError("Missing file in form data", 400);
    }

    const { storedPath, buffer } = await saveUploadedFile(entry);
    if (buffer.length > 20 * 1024 * 1024) {
      return jsonError("File is too large. Max size is 20MB.", 413);
    }

    const extractedText = await extractTextFromBuffer(entry.name, entry.type, buffer);

    return Response.json({
      filename: entry.name,
      filetype: entry.type || "text/plain",
      stored_path: storedPath,
      extracted_text: extractedText,
      preview: textPreview(extractedText, 800),
    });
  } catch (error) {
    return jsonError("Failed to extract uploaded file", 500, String(error));
  }
}
