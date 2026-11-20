import { AuditFindingRecord } from "./types";

export interface DatabaseTermRule {
  id: string;
  disallowed_term: string;
  approved_term: string;
  category: string;
  reason?: string;
  guideline_reference?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export const REQUIRED_PERFORMANCE_DISCLAIMER =
  "Results based on an internal pilot; individual results may vary.";

/**
 * Finds the sentence enclosing a given character offset range [start, end].
 */
export function getSentenceAround(
  text: string,
  start: number,
  end: number
): { sentence: string; start: number; end: number } {
  if (!text) return { sentence: "", start: 0, end: 0 };

  // Find sentence start (look backwards for punctuation or newline)
  let sStart = start;
  while (sStart > 0 && !/[.!?\n]/.test(text[sStart - 1])) {
    sStart--;
  }
  // Trim leading whitespace
  while (sStart < start && /\s/.test(text[sStart])) {
    sStart++;
  }

  // Find sentence end (look forwards for punctuation or newline)
  let sEnd = end;
  while (sEnd < text.length && !/[.!?\n]/.test(text[sEnd])) {
    sEnd++;
  }
  // Include the punctuation mark if present
  if (sEnd < text.length && /[.!?]/.test(text[sEnd])) {
    sEnd++;
  }

  return {
    sentence: text.slice(sStart, sEnd).trim(),
    start: sStart,
    end: sEnd,
  };
}

/**
 * Extracts all sentences with their start and end character offsets.
 */
export function extractAllSentences(
  text: string
): Array<{ sentence: string; start: number; end: number }> {
  const sentences: Array<{ sentence: string; start: number; end: number }> = [];
  const regex = /[^.!?\n]+(?:[.!?]+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const leadingSpace = raw.indexOf(trimmed);
      const start = match.index + leadingSpace;
      const end = start + trimmed.length;
      sentences.push({ sentence: trimmed, start, end });
    }
  }
  return sentences;
}

/**
 * Checks terminology rules and required brand disclaimers.
 */
export function checkTerminologyDeterministic(
  content: string,
  termRules: DatabaseTermRule[],
  hasPerformanceClaims: boolean,
  startFindingIndex: number = 1
): AuditFindingRecord[] {
  const findings: AuditFindingRecord[] = [];
  let counter = startFindingIndex;

  // 1. Terminology replacements
  for (const rule of termRules) {
    const escaped = rule.disallowed_term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const excerpt = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + excerpt.length;

      const severity =
        rule.severity ||
        (rule.disallowed_term.toLowerCase().includes("autonomous employee replacement") ||
        rule.disallowed_term.toLowerCase().includes("world's fastest") ||
        rule.disallowed_term.toLowerCase().includes("novacreative")
          ? "CRITICAL"
          : "MEDIUM");

      const explanation =
        rule.reason ||
        (rule as any).context ||
        `Disallowed terminology '${excerpt}'. Authorized standard is '${rule.approved_term}'.`;

      const guidelineReference =
        rule.guideline_reference ||
        "Corporate Terminology Registry: Brand Standards §3";

      // Build suggested replacement sentence (Requirement 6)
      const sentenceInfo = getSentenceAround(content, startIndex, endIndex);
      const suggestedReplacementSentence = sentenceInfo.sentence
        ? sentenceInfo.sentence.replace(excerpt, rule.approved_term)
        : rule.approved_term;

      findings.push({
        id: `FIND-${String(counter++).padStart(3, "0")}`,
        category: "terminology",
        severity,
        excerpt,
        startIndex,
        endIndex,
        explanation,
        guidelineReference,
        recommendedAction: `Replace with approved terminology: "${rule.approved_term}". ${rule.reason ? `Rationale: ${rule.reason}` : ""}`.trim(),
        suggestedReplacement: rule.approved_term,
        suggestedSentence: suggestedReplacementSentence,
        confidence: "high",
        isResolved: false,
      });
    }
  }

  // 2. Required Disclaimer Check for performance / pilot claims (Requirement 3)
  if (hasPerformanceClaims) {
    const normalizedContent = content.toLowerCase().replace(/\s+/g, " ");
    const normalizedDisclaimer = REQUIRED_PERFORMANCE_DISCLAIMER.toLowerCase().replace(/\s+/g, " ");

    const hasDisclaimer =
      normalizedContent.includes(normalizedDisclaimer) ||
      (normalizedContent.includes("internal pilot") && normalizedContent.includes("results may vary"));

    if (!hasDisclaimer) {
      // Find the specific sentence that contains the performance / pilot claim strictly
      const allSentences = extractAllSentences(content);
      const pilotSentence =
        allSentences.find((s) =>
          /\b(internal pilot|pilot|task completion|improved by \d+%|\d+%\s*(?:improvement|boost|gain|increase))\b/i.test(
            s.sentence
          )
        ) ||
        allSentences.find((s) =>
          /\b(\d+%\s*productivity|productivity by \d+%|\d+%\s*faster|\b\d+(?:\.\d+)?%\b)\b/i.test(s.sentence)
        ) ||
        allSentences.find((s) =>
          /\b(productivity|task completion|faster|efficiency)\b/i.test(s.sentence)
        );

      if (pilotSentence) {
        findings.push({
          id: `FIND-${String(counter++).padStart(3, "0")}`,
          category: "terminology",
          severity: "HIGH",
          excerpt: pilotSentence.sentence, // Full sentence containing the performance claim strictly
          startIndex: pilotSentence.start,
          endIndex: pilotSentence.end,
          explanation: `Mandatory legal disclaimer missing for performance metric claim: "${REQUIRED_PERFORMANCE_DISCLAIMER}"`,
          guidelineReference: "Compliance & Mandatory Disclaimers §4.1 (Pilot Performance Metric)",
          recommendedAction: `Append the required disclaimer: "${REQUIRED_PERFORMANCE_DISCLAIMER}"`,
          suggestedReplacement: `${pilotSentence.sentence} ${REQUIRED_PERFORMANCE_DISCLAIMER}`,
          confidence: "high",
          isResolved: false,
        });
      }
    }
  }

  return findings;
}
