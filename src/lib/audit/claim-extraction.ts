export interface RawExtractedClaim {
  text: string;
  startIndex: number;
  endIndex: number;
  claimType: "numerical" | "factual" | "comparative" | "promotional" | "opinion";
  numericValue?: number;
  unit?: string;
  metric?: string;
}

/**
 * Deterministic regex & heuristic claim extraction engine.
 * Locates claims, validates exact literal substrings, and returns character offsets.
 */
export function extractClaimsDeterministic(content: string): RawExtractedClaim[] {
  const claims: RawExtractedClaim[] = [];
  const visited = new Set<string>();

  function addClaim(
    text: string,
    startIndex: number,
    endIndex: number,
    claimType: RawExtractedClaim["claimType"],
    numericValue?: number,
    unit?: string,
    metric?: string
  ) {
    // Validate that excerpt is a literal substring
    if (content.slice(startIndex, endIndex) !== text) {
      return;
    }
    const key = `${startIndex}-${endIndex}`;
    if (!visited.has(key)) {
      visited.add(key);
      claims.push({
        text,
        startIndex,
        endIndex,
        claimType,
        numericValue,
        unit,
        metric,
      });
    }
  }

  // 1. Percentage claims (e.g. 300%, 18%, 24.5%)
  const pctRegex = /\b(\d+(?:\.\d+)?)\s*(%|percent)/gi;
  let match: RegExpExecArray | null;
  while ((match = pctRegex.exec(content)) !== null) {
    const val = parseFloat(match[1]);
    const matchedText = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + matchedText.length;

    // Infer metric context from surrounding words (e.g. productivity, task completion)
    const contextStart = Math.max(0, startIndex - 50);
    const contextEnd = Math.min(content.length, endIndex + 50);
    const window = content.slice(contextStart, contextEnd).toLowerCase();

    let metric = "general_performance";
    if (window.includes("productivity") || window.includes("task completion") || window.includes("efficiency")) {
      metric = "productivity_task_completion";
    }

    addClaim(matchedText, startIndex, endIndex, "numerical", val, "%", metric);
  }

  // 2. Multiplier claims (e.g. 3x, 10x, 2.5x)
  const multRegex = /\b(\d+(?:\.\d+)?)\s*x\b/gi;
  while ((match = multRegex.exec(content)) !== null) {
    const val = parseFloat(match[1]);
    addClaim(match[0], match.index, match.index + match[0].length, "numerical", val, "multiplier", "scale");
  }

  // 3. User / Customer / Business counts (e.g. "8,000 businesses", "12,400 customers")
  const countRegex = /(?:\b(?:trusted by|over|more than|serving)\s+)?(\d{1,3}(?:,\d{3})+|\d+)\s*(businesses|companies|customers|teams|users|enterprises)\b/gi;
  while ((match = countRegex.exec(content)) !== null) {
    const numStr = match[1].replace(/,/g, "");
    const val = parseInt(numStr, 10);
    addClaim(match[0], match.index, match.index + match[0].length, "numerical", val, match[2].toLowerCase(), "customer_business_count");
  }

  // 4. "Save N hours / days"
  const saveRegex = /\bsave\s+(\d+(?:\.\d+)?)\s*(hours|days|minutes|weeks)\b/gi;
  while ((match = saveRegex.exec(content)) !== null) {
    const val = parseFloat(match[1]);
    addClaim(match[0], match.index, match.index + match[0].length, "numerical", val, match[2].toLowerCase(), "time_savings");
  }

  // 5. Ranking & Superlative claims ("#1", "number one", "number 1", "world's fastest", "unbeatable", "industry-leading")
  const rankRegex = /(?:#\d+|\bnumber\s+(?:\d+|one)\b|world's\s+fastest|unbeatable|industry-leading|best\s+in\s+class|guaranteed)/gi;
  while ((match = rankRegex.exec(content)) !== null) {
    addClaim(match[0], match.index, match.index + match[0].length, "comparative");
  }

  return claims.sort((a, b) => a.startIndex - b.startIndex);
}
