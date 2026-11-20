import { AIRequestOptions, AIProviderResult } from "./types";
import { callGeminiStructured } from "./gemini";
import { callDemoStructured } from "./demo";
import { createAdminClient } from "@/lib/supabase/admin";

export * from "./types";

/**
 * Unified AI abstraction entrypoint.
 * Automatically checks organisation permissions and API key availability.
 * Retries once on schema validation error before throwing.
 */
export async function generateStructured<T>(
  options: AIRequestOptions<T>
): Promise<AIProviderResult<T>> {
  let allowExternal = options.allowExternalAI ?? true;

  // Check database settings if organisationId provided
  if (options.organisationId) {
    try {
      const supabase = createAdminClient();
      const { data: settings } = await supabase
        .from("organisation_settings")
        .select("ai_external_allowed")
        .eq("organisation_id", options.organisationId)
        .single();

      if (settings && settings.ai_external_allowed === false) {
        allowExternal = false;
      }
    } catch {
      // If error querying settings, default to safe mode
      allowExternal = false;
    }
  }

  const configuredProvider = process.env.AI_PROVIDER || "gemini";
  const geminiKey = process.env.GEMINI_API_KEY;

  // If external AI is not allowed, or configured as demo, or key missing -> use Demo engine
  if (!allowExternal || configuredProvider === "demo" || !geminiKey) {
    if (options.throwOnError && configuredProvider === "gemini") {
      throw new Error(`Live AI unavailable: ${!geminiKey ? "GEMINI_API_KEY missing" : !allowExternal ? "External AI disabled for organisation" : "Demo mode active"}`);
    }
    return await callDemoStructured(options);
  }

  const primaryModel = process.env.AI_MODEL || "gemini-3.8-flash";
  const fallbackModel = process.env.AI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

  const stageStartTime = Date.now();
  const MAX_AI_STAGE_TIME_MS = 28000; // Stay strictly under 30 seconds total AI time per stage

  let lastError: unknown = null;

  // 1. Primary Model: At most ONE retry, ONLY for 429/500/503 or timeout
  for (let attempt = 1; attempt <= 2; attempt++) {
    const elapsed = Date.now() - stageStartTime;
    const remainingTime = MAX_AI_STAGE_TIME_MS - elapsed;
    if (remainingTime < 3000) {
      break;
    }

    const callTimeout = Math.min(15000, remainingTime);

    try {
      if (configuredProvider === "gemini") {
        return await callGeminiStructured(options, geminiKey, primaryModel, callTimeout, false);
      }
      return await callDemoStructured(options);
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable =
        (err as { isRetryable?: boolean })?.isRetryable ||
        status === 429 ||
        status === 500 ||
        status === 503 ||
        status === 408 ||
        (err as { name?: string })?.name === "TimeoutError";

      // Only retry once on 429/500/503 or timeout, with a short backoff
      if (attempt === 1 && isRetryable) {
        const remainingAfterBackoff = MAX_AI_STAGE_TIME_MS - (Date.now() - stageStartTime);
        if (remainingAfterBackoff > 4000) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }
      break;
    }
  }

  // 2. Fallback Model: If primary model times out or returns 429/500/503, try fallback model ONCE
  if (configuredProvider === "gemini" && fallbackModel && fallbackModel !== primaryModel) {
    const elapsed = Date.now() - stageStartTime;
    const remainingTime = MAX_AI_STAGE_TIME_MS - elapsed;

    if (remainingTime >= 4000) {
      const callTimeout = Math.min(15000, remainingTime);
      try {
        return await callGeminiStructured(options, geminiKey, fallbackModel, callTimeout, true);
      } catch (fallbackErr: unknown) {
        lastError = fallbackErr;
      }
    }
  }

  // 3. If both models fail, rethrow if throwOnError is requested so honest status is reported
  if (options.throwOnError) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError || "All AI models failed or timed out"));
  }

  // Otherwise fall back gracefully to demo analysis mode
  console.warn("External AI call failed after retries and fallback model, falling back to demo engine:", lastError);
  return await callDemoStructured(options);
}
