/**
 * Rule-based candidate fact extractor.
 * Pattern-based extraction; a manager must review every candidate.
 * No AI is used at any point in this module.
 */

export interface CandidateFact {
  metricName: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  excerpt: string;
  pageNumber: number | null;
}

/** Patterns that signal a numeric claim with units or context */
const CANDIDATE_PATTERNS: RegExp[] = [
  // Percentages: "92% of customers"
  /\b(\d+(?:\.\d+)?)\s*%/i,
  // Counts: "2,500 customers" / "1000 businesses"
  /\b(\d[\d,]*)\s+(customers?|businesses?|users?|employees?|clients?|organisations?|teams?|companies)\b/i,
  // Duration: "2 days" / "48 hours" / "3 weeks"
  /\b(\d+(?:\.\d+)?)\s+(days?|hours?|minutes?|weeks?|months?)/i,
  // Currency: "$1,500" / "£2,000" / "€500"
  /[£$€](\d[\d,]*(?:\.\d+)?)/,
  // Ratings/scores: "rated 4.5" / "score of 92"
  /\b(?:rated?|scored?|achieved?)\s+(\d+(?:\.\d+)?)/i,
  // Year references: "in 2026 survey"
  /\b(20[12]\d)\s+(survey|report|study|data|audit|benchmark)/i,
];

/**
 * Split text into sentences with approximate page numbers.
 * Pages are estimated by character position if no form-feed markers exist.
 */
export function splitIntoSentences(
  text: string,
  totalPages?: number
): Array<{ sentence: string; pageNumber: number | null }> {
  const totalChars = text.length;
  // Split on sentence boundaries: . ? ! followed by whitespace + capital letter
  const raw = text.split(/(?<=[.?!])\s+(?=[A-Z"''])/);
  const results: Array<{ sentence: string; pageNumber: number | null }> = [];
  let charPos = 0;

  for (const sentence of raw) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      charPos += sentence.length + 1;
      continue;
    }
    let pageNumber: number | null = null;
    if (totalPages && totalChars > 0) {
      pageNumber = Math.max(1, Math.ceil((charPos / totalChars) * totalPages));
    }
    results.push({ sentence: trimmed, pageNumber });
    charPos += sentence.length + 1;
  }
  return results;
}

/**
 * Extract candidate facts from document text using pattern matching.
 * Returns de-duplicated candidates by excerpt key.
 */
export function extractCandidates(
  text: string,
  totalPages?: number
): CandidateFact[] {
  const sentences = splitIntoSentences(text, totalPages);
  const seen = new Set<string>();
  const candidates: CandidateFact[] = [];

  for (const { sentence, pageNumber } of sentences) {
    // Test if any pattern matches in this sentence
    const matched = CANDIDATE_PATTERNS.some((p) => {
      const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags);
      return re.test(sentence);
    });
    if (!matched) continue;

    const { metricName, value, numericValue, unit } = parseBestNumericFromSentence(sentence);

    const key = `${excerptKey(sentence)}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      metricName,
      value,
      numericValue,
      unit,
      excerpt: sentence,
      pageNumber,
    });
  }

  return candidates;
}

function excerptKey(s: string): string {
  return s.trim().toLowerCase().slice(0, 80);
}

function parseBestNumericFromSentence(sentence: string): {
  metricName: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
} {
  // Priority 1: percentage
  const pctMatch = sentence.match(/(\d+(?:\.\d+)?)\s*%(?:\s+of\s+([\w\s]{3,30}))?/i);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    const subject = pctMatch[2]?.trim() || inferSubject(sentence);
    return {
      metricName: subject ? `${capitalise(subject)} percentage` : "Percentage metric",
      value: `${num}%`,
      numericValue: num,
      unit: "%",
    };
  }

  // Priority 2: duration
  const durMatch = sentence.match(/(\d+(?:\.\d+)?)\s+(days?|hours?|minutes?|weeks?|months?)/i);
  if (durMatch) {
    const num = parseFloat(durMatch[1]);
    const unitWord = durMatch[2];
    const subject = inferSubject(sentence);
    return {
      metricName: subject ? `${capitalise(subject)} (${unitWord})` : `Duration (${unitWord})`,
      value: `${num} ${unitWord}`,
      numericValue: num,
      unit: unitWord,
    };
  }

  // Priority 3: count with noun
  const countMatch = sentence.match(/(\d[\d,]*)\s+(customers?|businesses?|users?|employees?|clients?)/i);
  if (countMatch) {
    const num = parseFloat(countMatch[1].replace(/,/g, ""));
    const noun = countMatch[2];
    return {
      metricName: `Number of ${noun}`,
      value: countMatch[1],
      numericValue: num,
      unit: noun,
    };
  }

  // Priority 4: currency
  const currMatch = sentence.match(/([£$€])(\d[\d,]*(?:\.\d+)?)/);
  if (currMatch) {
    const num = parseFloat(currMatch[2].replace(/,/g, ""));
    const subject = inferSubject(sentence);
    return {
      metricName: subject ? `${capitalise(subject)} value` : "Currency value",
      value: `${currMatch[1]}${currMatch[2]}`,
      numericValue: num,
      unit: currMatch[1],
    };
  }

  // Fallback: any number in sentence
  const anyNum = sentence.match(/(\d+(?:\.\d+)?)/);
  const subject = inferSubject(sentence);
  return {
    metricName: subject ? capitalise(subject) : "Numeric metric",
    value: anyNum ? anyNum[1] : sentence.slice(0, 40),
    numericValue: anyNum ? parseFloat(anyNum[1]) : null,
    unit: null,
  };
}

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "of", "is", "are", "was", "were", "that", "this",
  "our", "their", "its", "and", "or", "to", "for", "with", "on", "at", "by",
  "from", "has", "have", "been", "be", "as", "it", "we", "they",
]);

function inferSubject(sentence: string): string {
  const knownSubjects = [
    "customer satisfaction", "satisfaction", "onboarding", "retention", "productivity",
    "completion rate", "response time", "error rate", "adoption", "engagement",
    "revenue", "cost", "time", "rating", "score", "survey",
  ];
  const lower = sentence.toLowerCase();
  for (const s of knownSubjects) {
    if (lower.includes(s)) return s;
  }
  const tokens = sentence
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t.toLowerCase()))
    .slice(0, 3)
    .map((t) => t.replace(/[^a-zA-Z0-9 ]/g, ""));
  return tokens.join(" ").trim();
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
