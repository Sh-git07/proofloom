import { z } from "zod";

export type AITask =
  | "claim_extraction"
  | "evidence_selection"
  | "voice_analysis"
  | "rewrite"
  | "drift_insight";

export interface AIRequestOptions<T> {
  task: AITask;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  imageParts?: Array<{
    mimeType: string;
    data: string; // base64
  }>;
  organisationId?: string;
  allowExternalAI?: boolean;
}

export interface AIProviderResult<T> {
  data: T;
  provider: "gemini" | "demo" | "openai" | "anthropic";
  modelUsed: string;
  isSimulated: boolean;
  latencyMs: number;
}
