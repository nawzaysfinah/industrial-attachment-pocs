import fs from "node:fs";
import path from "node:path";

import mammoth from "mammoth";

import { env } from "@/lib/env";
import { normalizeWhitespace } from "@/lib/utils";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extensionFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext.replace(".", "");
}

export async function saveUploadedFile(file: File): Promise<{ storedPath: string; buffer: Buffer }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  fs.mkdirSync(env.FILE_STORAGE_DIR, { recursive: true });

  const safeName = sanitizeFilename(file.name || "upload.txt");
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
  const storedPath = path.join(env.FILE_STORAGE_DIR, uniqueName);

  fs.writeFileSync(storedPath, buffer);

  return { storedPath, buffer };
}

export async function extractTextFromBuffer(
  filename: string,
  filetype: string,
  buffer: Buffer,
): Promise<string> {
  const ext = filetype.toLowerCase() || extensionFromFilename(filename);

  if (ext.includes("pdf")) {
    const pdfParse = (await import("pdf-parse")).default as (input: Buffer) => Promise<{
      text: string;
    }>;
    const parsed = await pdfParse(buffer);
    return normalizeWhitespace(parsed.text);
  }

  if (ext.includes("docx") || ext.includes("vnd.openxmlformats-officedocument")) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result.value);
  }

  return normalizeWhitespace(buffer.toString("utf8"));
}
