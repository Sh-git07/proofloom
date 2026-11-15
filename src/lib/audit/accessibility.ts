import { AuditFindingRecord } from "./types";

/**
 * Approximates syllable count for English words
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, "");
  word = word.replace(/^y/, "");
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? Math.max(1, syllables.length) : 1;
}

/**
 * Calculates Flesch Reading Ease score
 * 90-100: Very Easy, 60-70: Standard, 0-30: Very Difficult
 */
export function calculateFleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0);

  if (sentences.length === 0 || words.length === 0) return 100;

  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const score =
    206.835 -
    1.015 * (words.length / sentences.length) -
    84.6 * (totalSyllables / words.length);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Deterministic text-level accessibility checks
 */
export function checkAccessibilityDeterministic(
  content: string,
  startFindingIndex: number = 1
): { findings: AuditFindingRecord[]; readingEaseScore: number } {
  const findings: AuditFindingRecord[] = [];
  let counter = startFindingIndex;
  const readingEaseScore = calculateFleschReadingEase(content);

  // 1. Long sentence checks (> 30 words)
  const sentenceRegex = /([^.!?]+[.!?]+)/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(content)) !== null) {
    const sentence = match[0].trim();
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;

    if (wordCount > 30) {
      const startIndex = match.index;
      const endIndex = startIndex + sentence.length;

      findings.push({
        id: `FIND-${String(counter++).padStart(3, "0")}`,
        category: "accessibility",
        severity: "LOW",
        excerpt: sentence.slice(0, 80) + "...",
        startIndex,
        endIndex,
        explanation: `Long sentence detected (${wordCount} words). Sentences exceeding 30 words impede cognitive accessibility.`,
        guidelineReference: "Text Accessibility & Plain Language Standards (Text-level checks only)",
        recommendedAction: "Break complex compound sentences into shorter, digestible phrases.",
        confidence: "high",
        isResolved: false,
      });
    }
  }

  // 2. Unclear / Missing CTA for promotional/ad content
  const hasVagueCta = /\b(click here|read more|learn more here)\b/gi;
  while ((match = hasVagueCta.exec(content)) !== null) {
    findings.push({
      id: `FIND-${String(counter++).padStart(3, "0")}`,
      category: "accessibility",
      severity: "LOW",
      excerpt: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      explanation: "Vague hyperlink / call-to-action anchor text lacks standalone semantic context for screen readers.",
      guidelineReference: "Accessible Content & Navigation §2.4 (Text-level checks only)",
      recommendedAction: "Use descriptive anchor copy that explains the destination (e.g. 'View the enterprise security report').",
      confidence: "high",
      isResolved: false,
    });
  }

  return { findings, readingEaseScore };
}
