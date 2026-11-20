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

  // Attempt external call with 1 retry on parse failure
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (configuredProvider === "gemini") {
        return await callGeminiStructured(options, geminiKey, process.env.AI_MODEL || "gemini-3.8-flash");
      }
      // If other providers unconfigured, fallback to demo
      return await callDemoStructured(options);
    } catch (err) {
      lastError = err;
      if (attempt === 1) {
        // Short pause before single retry
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }

  // On persistent failure, rethrow if throwOnError is requested so honest status can be reported
  if (options.throwOnError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  // Otherwise fall back gracefully to demo analysis mode so user task is never permanently blocked
  console.warn("External AI call failed after retry, falling back to deterministic demo engine:", lastError);
  return await callDemoStructured(options);
}
