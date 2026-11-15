import { describe, it, expect } from "vitest";
import { parseUploadedFile } from "@/lib/parser";

describe("File Parser Service", () => {
  it("parses plain text files accurately", async () => {
    const rawText = "Our platform increases productivity by 300% in our latest pilot.";
    const buffer = Buffer.from(rawText, "utf-8");

    const result = await parseUploadedFile(buffer, "test.txt", "text/plain");

    expect(result.text).toBe(rawText);
    expect(result.wordCount).toBe(10);
    expect(result.mimeType).toBe("text/plain");
    expect(result.fileName).toBe("test.txt");
  });

  it("rejects files exceeding 10MB limit", async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

    await expect(
      parseUploadedFile(largeBuffer, "huge.txt", "text/plain")
    ).rejects.toThrow(/exceeds limit/);
  });

  it("rejects unsupported file formats", async () => {
    const buffer = Buffer.from("executable code", "utf-8");

    await expect(
      parseUploadedFile(buffer, "malicious.exe", "application/x-msdownload")
    ).rejects.toThrow(/Unsupported file format/);
  });
});
