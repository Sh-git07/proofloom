import { NextRequest, NextResponse } from "next/server";
import { parseUploadedFile } from "@/lib/parser";
import { getCurrentUserContext } from "@/lib/auth-helpers";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseUploadedFile(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      text: parsed.text,
      fileName: parsed.fileName,
      wordCount: parsed.wordCount,
      pageCount: parsed.pageCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
