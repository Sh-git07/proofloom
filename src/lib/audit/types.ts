export type AuditSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type AuditDimension =
  | "voice"
  | "claims"
  | "terminology"
  | "accessibility"
  | "visual";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "OUTDATED"
  | "HUMAN_VERIFICATION_REQUIRED"
  | "UNSUPPORTED";

export interface AuditFindingRecord {
  id: string; // FIND-001, FIND-002, etc.
  category: AuditDimension;
  severity: AuditSeverity;
  excerpt: string;
  startIndex: number;
  endIndex: number;
  explanation: string;
  guidelineReference?: string;
  evidenceSourceId?: string;
  verificationStatus?: VerificationStatus;
  recommendedAction: string;
  suggestedReplacement?: string;
  suggestedSentence?: string;
  confidence: "high" | "medium" | "low";
  isResolved: boolean;
}

export interface ExtractedClaimRecord {
  id: string;
  claimText: string;
  claimType: "numerical" | "factual" | "comparative" | "promotional" | "opinion";
  startIndex: number;
  endIndex: number;
  matchedFactId?: string;
  matchedSourceId?: string;
  verificationStatus: VerificationStatus;
  toleranceVariancePercent?: number;
  comparisonExplanation: string;
}

export interface AuditScores {
  overall: number;
  voice: number;
  claims: number;
  terminology: number;
  accessibility: number;
  visual: number | null; // null if NOT CHECKED
  checkedDimensions: AuditDimension[];
}

export interface AuditStageProgress {
  stageNumber: number;
  stageName: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REQUIRES_REVIEW";
  startedAt?: string;
  completedAt?: string;
  findingsCount?: number;
  errorMessage?: string;
}
