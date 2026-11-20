#!/usr/bin/env node
/**
 * Generates sample source document files for testing the Evidence from Uploaded Documents feature.
 * Outputs: test-assets/pilot-report-v3.txt  (plain text, easy to ingest)
 *          test-assets/pilot-report-v3.pdf   (minimal hand-crafted PDF, no external deps)
 *
 * Run: npx tsx scripts/generate-sample-docs.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const REPORT_TEXT = `PILOT PROGRAM REPORT v3 — 2026
Prepared by: Research & Analytics Team
Date: October 2026

EXECUTIVE SUMMARY
-----------------
This report summarises findings from the 2026 customer pilot programme conducted across multiple
industry verticals.

SECTION 1 — CUSTOMER SATISFACTION
-----------------------------------
In the 2026 customer survey, 92% of customers rated the product satisfactory or above.
The survey covered 1,250 businesses across 12 industry verticals.
Customer retention improved to 87% year-over-year.

SECTION 2 — ONBOARDING EFFICIENCY
-----------------------------------
Average onboarding time is 2 days, down from 5 days in the previous year.
Support ticket resolution averages 4 hours after the latest workflow improvements.
97% of new users completed the onboarding checklist within their first week.

SECTION 3 — COMMERCIAL PERFORMANCE
-------------------------------------
The average deal size increased to $14,500 in Q3 2026.
Total pilot revenue reached $2,100,000 across 145 enterprise accounts.
The programme achieved a 34% reduction in time-to-value compared to 2025 benchmarks.

SECTION 4 — CONCLUSION
-------------------------
The 2026 pilot data demonstrates strong product-market fit and improving operational efficiency.
All metrics should be treated as internal benchmarks subject to external audit verification.
`;

const DEST = join(process.cwd(), "test-assets");

function generateMinimalPdf(text: string): Buffer {
  // Hand-crafted minimal PDF 1.4 — no external dependencies.
  // Encodes the text as a single-page document with a monospace font.
  const lines = text.split("\n");
  // Build page content stream
  const contentLines: string[] = ["BT", "/F1 10 Tf", "1 0 0 1 50 780 Tm", "14 TL"];
  for (const line of lines) {
    // Escape PDF special chars
    const safe = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    contentLines.push(`(${safe}) Tj T*`);
  }
  contentLines.push("ET");
  const streamContent = contentLines.join("\n");
  const streamBytes = Buffer.from(streamContent, "latin1");

  // Build objects
  const objs: string[] = [];
  // obj 1: catalog
  objs.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // obj 2: pages
  objs.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  // obj 3: page
  objs.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n   /Resources << /Font << /F1 4 0 R >> >>\n   /Contents 5 0 R >>\nendobj"
  );
  // obj 4: font
  objs.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj"
  );
  // obj 5: content stream
  const streamLen = streamBytes.length;
  objs.push(
    `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj`
  );

  // Cross-reference table
  const header = Buffer.from("%PDF-1.4\n", "latin1");
  const offsets: number[] = [];
  let pos = header.length;
  const objBufs = objs.map((o) => {
    const b = Buffer.from(o + "\n", "latin1");
    offsets.push(pos);
    pos += b.length;
    return b;
  });

  const xrefStart = pos;
  const xref = [
    "xref",
    `0 ${offsets.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "",
    "trailer",
    `<< /Size ${offsets.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");

  return Buffer.concat([header, ...objBufs, Buffer.from(xref, "latin1")]);
}

function run() {
  mkdirSync(DEST, { recursive: true });

  // TXT
  const txtPath = join(DEST, "pilot-report-v3.txt");
  writeFileSync(txtPath, REPORT_TEXT, "utf8");
  console.log(`✓ Written: ${txtPath}`);

  // PDF
  const pdfPath = join(DEST, "pilot-report-v3.pdf");
  const pdfBuf = generateMinimalPdf(REPORT_TEXT);
  writeFileSync(pdfPath, pdfBuf);
  console.log(`✓ Written: ${pdfPath}`);

  console.log("\nSample facts to verify extraction:");
  console.log("  • 92% of customers rated the product satisfactory");
  console.log("  • 1,250 businesses covered");
  console.log("  • Average onboarding time is 2 days");
  console.log("  • Customer retention improved to 87%");
  console.log("  • $14,500 average deal size");
}

run();
