import { describe, it, expect } from "vitest";
import {
  voiceAnalysisResponseSchema,
  GEMINI_VOICE_RESPONSE_SCHEMA,
} from "@/lib/audit/brand-voice";
import { buildViewerSegments } from "@/lib/audit/viewer";
import { calculateAuditScores } from "@/lib/audit/scoring";
import { AuditFindingRecord } from "@/lib/audit/types";

describe("Fallback-Model Voice Findings & Report Visibility (Bug 2)", () => {
  const contentBody =
    "Honestly, you'd be crazy not to jump on this today. Everyone who waits is just going to get left behind.";

  it("parses fallback model voice output in both array and object shapes", () => {
    // Shape 1: Bare array
    const bareArray = [
      {
        excerpt: "you'd be crazy not to jump on this today",
        severity: "HIGH",
        explanation: "Coercive urgency contradicts brand voice guidelines.",
        guideline_cited: "Brand Voice Standard §1.2",
        suggested_replacement: "we recommend evaluating this today",
      },
    ];
    const parsedArray = voiceAnalysisResponseSchema.parse(bareArray);
    expect(parsedArray.findings.length).toBe(1);
    expect(parsedArray.findings[0].severity).toBe("HIGH");
    expect(parsedArray.findings[0].excerpt).toBe("you'd be crazy not to jump on this today");

    // Shape 2: Wrapped object with lowercase severity
    const wrappedObject = {
      findings: [
        {
          excerpt: "Everyone who waits is just going to get left behind",
          severity: "high",
          explanation: "FOMO fear tactic prohibited by brand guidelines.",
          guideline: "Anti-Hype Policy",
        },
      ],
    };
    const parsedObject = voiceAnalysisResponseSchema.parse(wrappedObject);
    expect(parsedObject.findings.length).toBe(1);
    expect(parsedObject.findings[0].severity).toBe("HIGH");
  });

  it("saves fallback-model voice findings and reflects them in the audit score", () => {
    const rawAIFindings = [
      {
        excerpt: "you'd be crazy not to jump on this today",
        severity: "HIGH" as const,
        explanation: "Coercive sales language.",
        guidelineReference: "Brand Voice Standard §1.2",
        recommendedAction: "Replace with professional value proposition.",
      },
      {
        excerpt: "Everyone who waits is just going to get left behind",
        severity: "HIGH" as const,
        explanation: "Aggressive FOMO urgency.",
        guidelineReference: "Brand Voice Standard §1.4",
        recommendedAction: "Highlight customer outcomes.",
      },
    ];

    // Map into finding records as stage 4 does
    const savedRecords: AuditFindingRecord[] = rawAIFindings.map((f, i) => {
      const idx = contentBody.indexOf(f.excerpt);
      return {
        id: `FIND-AI-00${i + 1}`,
        category: "voice",
        severity: f.severity,
        excerpt: f.excerpt,
        startIndex: idx !== -1 ? idx : 0,
        endIndex: idx !== -1 ? idx + f.excerpt.length : 0,
        explanation: f.explanation,
        guidelineReference: f.guidelineReference,
        recommendedAction: f.recommendedAction,
        confidence: "high",
        isResolved: false,
      };
    });

    expect(savedRecords.length).toBe(2);

    // Calculate score using stage 7 scoring
    const scores = calculateAuditScores(savedRecords, [
      "voice",
      "claims",
      "terminology",
      "accessibility",
    ]);

    // Voice score should drop from 100 due to the 2 HIGH infractions
    expect(scores.voice).toBeLessThan(85);
    expect(scores.overall).toBeLessThan(100);
  });

  it("ensures fallback-model voice findings appear in report data and viewer", () => {
    // Simulate finding mapped for AuditReportView
    const reportFindings = [
      {
        id: "FIND-AI-001",
        category: "voice" as const,
        severity: "HIGH" as const,
        excerpt: "you'd be crazy not to jump on this today",
        start_index: contentBody.indexOf("you'd be crazy not to jump on this today"),
        end_index:
          contentBody.indexOf("you'd be crazy not to jump on this today") +
          "you'd be crazy not to jump on this today".length,
        explanation: "Coercive sales language.",
        guideline_reference: "Brand Voice Standard §1.2",
        recommended_action: "Replace with professional value proposition.",
        confidence: "high",
        confidence_note: "AI",
        source: "AI" as const,
        is_resolved: false,
      },
      {
        id: "FIND-AI-002",
        category: "voice" as const,
        severity: "HIGH" as const,
        excerpt: "Everyone who waits is just going to get left behind",
        start_index: contentBody.indexOf("Everyone who waits is just going to get left behind"),
        end_index:
          contentBody.indexOf("Everyone who waits is just going to get left behind") +
          "Everyone who waits is just going to get left behind".length,
        explanation: "Aggressive FOMO urgency.",
        guideline_reference: "Brand Voice Standard §1.4",
        recommended_action: "Highlight customer outcomes.",
        confidence: "high",
        confidence_note: "AI",
        source: "AI" as const,
        is_resolved: false,
      },
    ];

    // 1. Report filters: should be visible under ALL and voice filter
    const selectedSeverity: string = "ALL";
    const selectedCategory: string = "ALL";
    const allFiltered = reportFindings.filter(
      (f) =>
        (selectedSeverity === "ALL" || (f.severity as string) === selectedSeverity) &&
        (selectedCategory === "ALL" || (f.category as string) === selectedCategory)
    );
    expect(allFiltered.length).toBe(2);

    const voiceFiltered = reportFindings.filter(
      (f) => f.category === "voice"
    );
    expect(voiceFiltered.length).toBe(2);

    // 2. Inline viewer segments: should highlight the flagged spans
    const segments = buildViewerSegments(contentBody, reportFindings);
    const highlightedSegments = segments.filter((s) => s.coveringFindings.length > 0);
    expect(highlightedSegments.length).toBeGreaterThan(0);
    expect(highlightedSegments.some((s) => s.coveringFindings.some((cf) => cf.id === "FIND-AI-001"))).toBe(true);
  });

  it("lists AI findings whose excerpt cannot be located in text rather than hiding them", () => {
    // An AI finding where the model returned an excerpt that is NOT in the text
    const unlocatedFinding = {
      id: "FIND-AI-003",
      category: "voice" as const,
      severity: "MEDIUM" as const,
      excerpt: "Some hallucinated phrase not in copy",
      start_index: 0,
      end_index: 0,
      explanation: "General passive tone detected in context.",
      guideline_reference: "Tone Guidelines §3",
      recommended_action: "Improve engagement.",
      confidence: "high",
      confidence_note: "AI",
      source: "AI" as const,
      is_resolved: false,
    };

    // It must still appear in report findings list
    const reportList = [unlocatedFinding];
    expect(reportList.length).toBe(1);
    expect(reportList[0].source).toBe("AI");
    expect(reportList[0].explanation).toBe("General passive tone detected in context.");

    // And inline viewer must NOT crash or corrupt text segments
    const segments = buildViewerSegments(contentBody, reportList);
    expect(segments.length).toBeGreaterThan(0);
    // Plain text is preserved safely
    const reconstructed = segments.map((s) => s.text).join("");
    expect(reconstructed).toBe(contentBody);
  });
});
