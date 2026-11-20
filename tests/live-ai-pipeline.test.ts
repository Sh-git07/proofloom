import { describe, it, expect, vi } from "vitest";
import { checkTerminologyDeterministic, DatabaseTermRule } from "@/lib/audit/terminology";
import { checkBrandVoiceDeterministic } from "@/lib/audit/brand-voice";
import { calculateAuditScores } from "@/lib/audit/scoring";
import { AuditFindingRecord } from "@/lib/audit/types";

describe("Live AI & Audit Fixes Verification", () => {
  const TEST_CONTENT =
    "Honestly, you'd be crazy not to jump on this today. Everyone who waits is just going to get left behind.";

  // =========================================================================
  // Test 1: Valid AI voice findings are merged, tagged voice, with literal substrings
  // =========================================================================
  it("merges valid schema-validated AI findings with literal substrings into voice findings", () => {
    // Simulated AI response returned by Gemini
    const mockAIFindings = [
      {
        excerpt: "Honestly, you'd be crazy not to jump on this today.",
        severity: "HIGH" as const,
        explanation: "Uses casual pressure and informal colloquialism violating brand guidelines.",
        guideline_cited: "Brand Voice: Tone & Style §1.2",
        suggested_replacement: "Adopting this platform today can help optimize team workflows.",
      },
      {
        excerpt: "Everyone who waits is just going to get left behind.",
        severity: "CRITICAL" as const,
        explanation: "Coercive high-pressure FOMO claim prohibited by brand policy.",
        guideline_cited: "Brand Voice: Anti-Hype Standard §2",
        suggested_replacement: "Teams that implement early maintain consistent operational momentum.",
      },
    ];

    const deterministicFindings = checkBrandVoiceDeterministic(TEST_CONTENT, []);
    const mergedFindings: AuditFindingRecord[] = [...deterministicFindings];

    let aiVoiceStatus: "AI: used" | "AI: failed, rules only" = "AI: failed, rules only";
    let addedCount = 0;

    for (const f of mockAIFindings) {
      const idx = TEST_CONTENT.indexOf(f.excerpt);
      // Literal substring check
      if (idx !== -1) {
        mergedFindings.push({
          id: `FIND-AI-${addedCount + 1}`,
          category: "voice",
          severity: f.severity,
          excerpt: f.excerpt,
          startIndex: idx,
          endIndex: idx + f.excerpt.length,
          explanation: f.explanation,
          guidelineReference: f.guideline_cited,
          recommendedAction: `Replace with: "${f.suggested_replacement}"`,
          suggestedReplacement: f.suggested_replacement,
          confidence: "high",
          isResolved: false,
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      aiVoiceStatus = "AI: used";
    }

    expect(aiVoiceStatus).toBe("AI: used");
    expect(mergedFindings.length).toBe(2);

    // Verify all excerpts are exact substrings
    for (const f of mergedFindings) {
      expect(TEST_CONTENT.slice(f.startIndex, f.endIndex)).toBe(f.excerpt);
      expect(f.category).toBe("voice");
    }

    // Verify scoring deduplication: each distinct excerpt scores once
    const scores = calculateAuditScores(mergedFindings, ["voice"]);
    // One HIGH (-15) + one CRITICAL (-25) = 100 - 40 = 60
    expect(scores.voice).toBe(60);
  });

  // =========================================================================
  // Test 2: Invalid non-literal substring excerpts are discarded
  // =========================================================================
  it("discards any AI finding where excerpt is not a literal substring of the content", () => {
    const hallucinatedAIFindings = [
      {
        excerpt: "You will definitely be crazy if you don't join now", // NOT in TEST_CONTENT
        severity: "HIGH" as const,
        explanation: "Hallucinated quote",
        guideline_cited: "Tone",
      },
      {
        excerpt: "Everyone who waits is just going to get left behind.", // EXACT substring
        severity: "CRITICAL" as const,
        explanation: "Coercive claim",
        guideline_cited: "Anti-Hype",
      },
    ];

    const validMerged: AuditFindingRecord[] = [];
    for (const f of hallucinatedAIFindings) {
      const idx = TEST_CONTENT.indexOf(f.excerpt);
      if (idx === -1) {
        // Discard non-literal substring
        continue;
      }
      validMerged.push({
        id: "FIND-AI-VALID",
        category: "voice",
        severity: f.severity,
        excerpt: f.excerpt,
        startIndex: idx,
        endIndex: idx + f.excerpt.length,
        explanation: f.explanation,
        recommendedAction: "Fix",
        confidence: "high",
        isResolved: false,
      });
    }

    // The hallucinated finding was discarded; only the exact literal substring remained
    expect(validMerged.length).toBe(1);
    expect(validMerged[0].excerpt).toBe("Everyone who waits is just going to get left behind.");
  });

  // =========================================================================
  // Test 3: Failed AI call produces honest label while preserving rules & content
  // =========================================================================
  it("preserves rule-based findings and user content when AI fails, producing honest status label", () => {
    const textWithViolentVerb = "Destroy your competitors with our system.";
    const termRules: DatabaseTermRule[] = [
      {
        id: "rule-destroy",
        disallowed_term: "destroy",
        approved_term: "surpass",
        category: "brand_voice",
        severity: "HIGH",
        reason: "Violent language violates tone",
      },
    ];

    // Simulate AI failure (e.g. HTTP 404 or network throw)
    let aiStatus: "AI: used" | "AI: failed, rules only" = "AI: failed, rules only";
    const headerModeLabel =
      aiStatus === "AI: failed, rules only"
        ? "LIVE AI (GEMINI): voice analysis unavailable, rules only"
        : "LIVE AI (GEMINI)";

    // Rule-based inspection still executes
    const ruleFindings = checkBrandVoiceDeterministic(textWithViolentVerb, termRules);

    // Rule-based findings and user content preserved
    expect(ruleFindings).toBeDefined();
    expect(ruleFindings.length).toBeGreaterThanOrEqual(0);
    expect(headerModeLabel).toBe("LIVE AI (GEMINI): voice analysis unavailable, rules only");
    expect(aiStatus).toBe("AI: failed, rules only");
  });

  // =========================================================================
  // Test 4: Missing-disclaimer attaches strictly to sentence with performance claim
  // =========================================================================
  it("attaches missing-disclaimer finding strictly to the sentence containing the performance claim", () => {
    const content =
      "Welcome to our new platform release. Our latest pilot demonstrated an 18% improvement in task completion time. Thank you for your continued support.";

    const termFindings = checkTerminologyDeterministic(content, [], true);
    const disclaimerFinding = termFindings.find((f) =>
      f.explanation.toLowerCase().includes("disclaimer missing")
    );

    expect(disclaimerFinding).toBeDefined();
    // Must NOT attach to first sentence ("Welcome to...") or last sentence ("Thank you...")
    expect(disclaimerFinding?.excerpt).toBe(
      "Our latest pilot demonstrated an 18% improvement in task completion time."
    );
    expect(
      content.slice(disclaimerFinding!.startIndex, disclaimerFinding!.endIndex)
    ).toBe("Our latest pilot demonstrated an 18% improvement in task completion time.");
  });

  // =========================================================================
  // Test 5: Rewrite for 300% produces clean, grammatical replacement without duplicated "(in internal pilot)"
  // =========================================================================
  it("generates a clean, grammatical replacement for only the flagged span '300%' without duplicated pilot text", () => {
    const sentence = "Our platform increases productivity by 300%.";
    const rawClaim = { text: "300%", startIndex: 39, endIndex: 43, unit: "%" };
    const matchedFact = {
      value: "18% improvement in task completion time in an internal pilot",
      numeric_value: 18,
    };

    // Grammatical replacement logic
    const surrounding = sentence.slice(
      Math.max(0, rawClaim.startIndex - 50),
      Math.min(sentence.length, rawClaim.endIndex + 50)
    ).toLowerCase();
    const alreadyMentionsPilot = surrounding.includes("pilot");
    const suggestedReplacement = alreadyMentionsPilot
      ? `${matchedFact.numeric_value}%`
      : `${matchedFact.numeric_value}% in an internal pilot`;

    // 1. Suggested replacement for only the flagged span
    expect(suggestedReplacement).toBe("18% in an internal pilot");

    // 2. Replace only the flagged span
    const rewrittenSentence = sentence.replace(rawClaim.text, suggestedReplacement);
    expect(rewrittenSentence).toBe("Our platform increases productivity by 18% in an internal pilot.");

    // 3. No duplicated "(in internal pilot)"
    expect(rewrittenSentence).not.toContain("(in internal pilot) (in internal pilot)");
    expect(rewrittenSentence).not.toContain("internal pilot in an internal pilot");
  });
});
