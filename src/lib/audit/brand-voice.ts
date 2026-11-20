import { AuditFindingRecord } from "./types";
import { z } from "zod";

export interface VoiceRule {
  pattern: RegExp;
  category: "aggressive" | "hype" | "superlative" | "slang";
  issue: string;
  recommendation: string;
  replacement?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
}

export const VOICE_RULES: VoiceRule[] = [
  {
    pattern: /\b(destroy|crush|kill|obliterate)\b/gi,
    category: "aggressive",
    issue: "Combative, aggressive sales language conflicts with 'Human, Approachable, Professional' voice guideline.",
    recommendation: "Replace with constructive value proposition (e.g. 'outperform', 'exceed expectations').",
    replacement: "outpace",
    severity: "HIGH",
  },
  {
    pattern: /\b(revolutionary|game-changing|groundbreaking|miracle)\b/gi,
    category: "hype",
    issue: "Unsubstantiated hyperbole and tech buzzwords prohibited by published brand standards.",
    recommendation: "Describe precise capabilities rather than generic industry hype.",
    replacement: "purpose-built",
    severity: "MEDIUM",
  },
  {
    pattern: /\b(#1|number one|world's best|unbeatable|guaranteed)\b/gi,
    category: "superlative",
    issue: "Unqualified superlative claim creates legal exposure and contradicts evidence guidelines.",
    recommendation: "Provide verified empirical evidence or remove absolute superlative phrasing.",
    replacement: "leading",
    severity: "HIGH",
  },
];

/**
 * Deterministic Brand Voice Inspector.
 * If termRules are supplied, skips voice findings for spans that match a terminology rule
 * or comparative superlative claims ("number one"), ensuring no duplicate findings for the same span.
 */
export function checkBrandVoiceDeterministic(
  content: string,
  termRules?: Array<{ disallowed_term: string }>,
  startFindingIndex: number = 1
): AuditFindingRecord[] {
  const findings: AuditFindingRecord[] = [];
  let findingCounter = startFindingIndex;

  const normalizedDisallowed = new Set(
    (termRules || []).map((r) => r.disallowed_term.trim().toLowerCase())
  );

  for (const rule of VOICE_RULES) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      const excerpt = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + excerpt.length;
      const lowerExcerpt = excerpt.trim().toLowerCase();

      // Skip "number one" because it is extracted as a comparative claim (Requirement 4)
      if (lowerExcerpt === "number one" || lowerExcerpt === "#1") {
        continue;
      }

      // If span or word matches a terminology rule, skip the voice finding (Requirement 1)
      if (normalizedDisallowed.has(lowerExcerpt)) {
        continue;
      }

      // Also check if any terminology rule phrase overlaps or covers this word
      const matchesAnyRule = Array.from(normalizedDisallowed).some(
        (disallowed) =>
          disallowed === lowerExcerpt ||
          (disallowed.length > 3 && lowerExcerpt.includes(disallowed)) ||
          (lowerExcerpt.length > 3 && disallowed.includes(lowerExcerpt))
      );
      if (matchesAnyRule) {
        continue;
      }

      findings.push({
        id: `FIND-${String(findingCounter++).padStart(3, "0")}`,
        category: "voice",
        severity: rule.severity,
        excerpt,
        startIndex,
        endIndex,
        explanation: rule.issue,
        guidelineReference: "Brand Voice Guidelines: Tone, Style & Hype Reduction",
        recommendedAction: rule.recommendation,
        suggestedReplacement: rule.replacement,
        confidence: "high",
        isResolved: false,
      });
    }
  }

  return findings;
}

export const voiceFindingItemSchema = z
  .object({
    excerpt: z.string().default(""),
    severity: z
      .string()
      .optional()
      .transform((val) => (val ? val.toUpperCase() : "MEDIUM"))
      .pipe(z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]))
      .or(z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]))
      .default("MEDIUM"),
    explanation: z.string().default("Brand voice violation detected."),
    guideline_cited: z.string().optional().default("Brand Voice Standard"),
    guideline: z.string().optional(),
    suggested_replacement: z.string().optional(),
    replacement: z.string().optional(),
  })
  .transform((item) => ({
    excerpt: item.excerpt.trim(),
    severity: (typeof item.severity === "string" ? item.severity.toUpperCase() : item.severity) as
      | "CRITICAL"
      | "HIGH"
      | "MEDIUM"
      | "LOW"
      | "INFO",
    explanation: item.explanation,
    guideline_cited: item.guideline_cited || item.guideline || "Brand Voice Standard",
    suggested_replacement: item.suggested_replacement || item.replacement,
  }));

export const voiceAnalysisResponseSchema = z
  .union([
    z.array(voiceFindingItemSchema),
    z.object({
      findings: z.array(voiceFindingItemSchema),
    }),
  ])
  .transform((val) => {
    if (Array.isArray(val)) {
      return { findings: val };
    }
    return val;
  });

export type VoiceAnalysisResponse = z.infer<typeof voiceAnalysisResponseSchema>;

export const GEMINI_VOICE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          excerpt: { type: "STRING" },
          severity: {
            type: "STRING",
            enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"],
          },
          explanation: { type: "STRING" },
          guideline_cited: { type: "STRING" },
          suggested_replacement: { type: "STRING" },
        },
        required: ["excerpt", "severity", "explanation"],
      },
    },
  },
  required: ["findings"],
};
