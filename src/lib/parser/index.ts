import { extractText } from "unpdf";
import mammoth from "mammoth";

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
  mimeType: string;
  fileName: string;
}

export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Validates and extracts plain text from uploaded files (PDF, DOCX, TXT)
 */
export async function parseUploadedFile(
  buffer: Buffer | Uint8Array,
  fileName: string,
  mimeType?: string
): Promise<ParsedDocument> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds limit of 10MB.`);
  }

  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  const rawBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  let extractedText = "";
  let pageCount: number | undefined;

  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      const result = await extractText(new Uint8Array(rawBuffer));
      extractedText = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text || "");
      pageCount = result.totalPages;
    } catch (err: unknown) {
      throw new Error(`Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (
    ext === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer: rawBuffer });
      extractedText = result.value;
    } catch (err: unknown) {
      throw new Error(`Failed to parse DOCX: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (ext === ".txt" || mimeType === "text/plain") {
    extractedText = rawBuffer.toString("utf-8");
  } else {
    throw new Error(
      `Unsupported file format "${ext}". Supported formats are PDF (.pdf), Word (.docx), and Plain Text (.txt).`
    );
  }

  // Clean extracted text (normalize excessive line returns and carriage returns)
  const cleaned = extractedText.replace(/\r\n/g, "\n").trim();
  const wordCount = cleaned.length > 0 ? cleaned.split(/\s+/).filter(Boolean).length : 0;

  return {
    text: cleaned,
    pageCount,
    wordCount,
    mimeType: mimeType || (ext === ".pdf" ? "application/pdf" : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain"),
    fileName,
  };
}
