import { AIRequestOptions, AIProviderResult } from "./types";

/**
 * Deterministic rule-based template generation for offline / demo mode
 * Never fakes LLM execution; strictly maps heuristic patterns to structured schemas.
 */
export async function callDemoStructured<T>(
  options: AIRequestOptions<T>
): Promise<AIProviderResult<T>> {
  const startTime = Date.now();
  const text = options.prompt.toLowerCase();
  let result: unknown;

  if (options.task === "claim_extraction") {
    const claims: Array<{
      claim_text: string;
      claim_type: "numerical" | "factual" | "comparative" | "promotional" | "opinion";
      confidence: "high" | "medium" | "low";
    }> = [];

    // Check for numerical percentages
    const pctMatch = options.prompt.match(/\b(\d+(?:\.\d+)?%)\b/);
    if (pctMatch) {
      claims.push({
        claim_text: pctMatch[0],
        claim_type: "numerical",
        confidence: "high",
      });
    }

    // Check for user/business counts like 8,000 or 12,400
    const countMatch = options.prompt.match(/\b(?:trusted by|over|more than)?\s*([\d,]+)\s*(?:businesses|companies|customers|teams)\b/i);
    if (countMatch) {
      claims.push({
        claim_text: countMatch[0],
        claim_type: "numerical",
        confidence: "high",
      });
    }

    // Check for superlative / comparative claims
    const compMatch = options.prompt.match(/\b(#1|world's fastest|unbeatable|industry leading|best in class)\b/i);
    if (compMatch) {
      claims.push({
        claim_text: compMatch[0],
        claim_type: "comparative",
        confidence: "medium",
      });
    }

    result = { claims };
  } else if (options.task === "voice_analysis") {
    const findings: Array<{
      excerpt: string;
      issue: string;
      suggestion: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    }> = [];

    if (text.includes("destroy") || text.includes("crush")) {
      findings.push({
        excerpt: text.includes("destroy") ? "destroy" : "crush",
        issue: "Aggressive, combative language violates the 'Human, Approachable, Professional' voice guideline.",
        suggestion: "Replace combative phrasing with value-focused outcomes (e.g., 'surpass targets' or 'outpace challenges').",
        severity: "HIGH",
      });
    }

    if (text.includes("revolutionary") || text.includes("game-changing")) {
      findings.push({
        excerpt: text.includes("revolutionary") ? "revolutionary" : "game-changing",
        issue: "Unsupported tech hype buzzword flagged in brand guidelines.",
        suggestion: "Use specific descriptive language like 'purpose-built' or 'next-generation'.",
        severity: "MEDIUM",
      });
    }

    result = { findings };
  } else if (options.task === "evidence_selection") {
    // If prompt mentions candidates, select the first matching candidate or none
    result = {
      selected_id: null,
      reasoning: "Rule-based heuristic candidate selection: no deterministic candidate confidently linked in demo mode.",
    };
  } else if (options.task === "rewrite") {
    let rewritten = options.prompt;
    if (text.includes("300%")) {
      rewritten = options.prompt.replace(/300%/gi, "18% in an internal pilot (individual results may vary)");
    } else if (text.includes("destroy your competition")) {
      rewritten = options.prompt.replace(/destroy your competition/gi, "accelerate your team's workflow");
    } else if (text.includes("revolutionary")) {
      rewritten = options.prompt.replace(/revolutionary/gi, "purpose-built");
    } else if (text.includes("8,000")) {
      rewritten = options.prompt.replace(/8,000/gi, "12,400");
    }

    result = {
      rewritten_text: rewritten,
      intent_preserved: true,
      explanation: "Deterministic template rewrite applied based on approved brand guidelines.",
    };
  } else {
    result = {};
  }

  const validated = options.schema.parse(result);

  return {
    data: validated,
    provider: "demo",
    modelUsed: "deterministic-rules-engine",
    isSimulated: true,
    latencyMs: Date.now() - startTime,
  };
}
