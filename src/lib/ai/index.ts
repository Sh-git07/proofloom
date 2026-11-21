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
  const HARD_TIMEOUT_MS = 15000;
  const HEDGE_DELAY_MS = 8000;

  if (configuredProvider !== "gemini") {
    return await callDemoStructured(options);
  }

  // Hedged Request Pattern:
  // 1. Send request to primaryModel with 15s hard timeout.
  // 2. If no response after 8 seconds, OR if primary returns 429/500/503/timeout, immediately start fallbackModel in parallel.
  // 3. Use whichever returns valid JSON first (aborting the other).
  // 4. Budget capped at 30 seconds total per stage.

  let primaryAbort = new AbortController();
  let fallbackAbort = new AbortController();

  let fallbackStarted = false;
  let primaryError: unknown = null;
  let fallbackError: unknown = null;

  const runPrimary = async (): Promise<AIProviderResult<T>> => {
    const elapsed = Date.now() - stageStartTime;
    const remainingTime = Math.min(HARD_TIMEOUT_MS, MAX_AI_STAGE_TIME_MS - elapsed);
    if (remainingTime < 1000) {
      throw new Error("AI stage budget exceeded before primary model invocation");
    }
    return await callGeminiStructured(
      { ...options, abortSignal: primaryAbort.signal },
      geminiKey,
      primaryModel,
      remainingTime,
      false
    );
  };

  const runFallback = async (): Promise<AIProviderResult<T>> => {
    const elapsed = Date.now() - stageStartTime;
    const remainingTime = Math.min(HARD_TIMEOUT_MS, MAX_AI_STAGE_TIME_MS - elapsed);
    if (remainingTime < 1000) {
      throw new Error("AI stage budget exceeded before fallback model invocation");
    }
    return await callGeminiStructured(
      { ...options, abortSignal: fallbackAbort.signal },
      geminiKey,
      fallbackModel,
      remainingTime,
      true
    );
  };

  try {
    const result = await new Promise<AIProviderResult<T>>((resolve, reject) => {
      let isSettled = false;
      let primaryFailed = false;
      let fallbackFailed = false;

      const triggerFallback = () => {
        if (fallbackStarted || isSettled) return;
        fallbackStarted = true;

        runFallback()
          .then((res) => {
            if (!isSettled) {
              isSettled = true;
              primaryAbort.abort();
              resolve(res);
            }
          })
          .catch((err) => {
            fallbackError = err;
            fallbackFailed = true;
            if (primaryFailed && !isSettled) {
              isSettled = true;
              reject(primaryError || fallbackError);
            }
          });
      };

      // 8-second hedge timer
      const hedgeTimer = setTimeout(() => {
        triggerFallback();
      }, HEDGE_DELAY_MS);

      // Start primary call
      runPrimary()
        .then((res) => {
          clearTimeout(hedgeTimer);
          if (!isSettled) {
            isSettled = true;
            fallbackAbort.abort();
            resolve(res);
          }
        })
        .catch((err) => {
          clearTimeout(hedgeTimer);
          primaryError = err;
          primaryFailed = true;

          const status = (err as { status?: number })?.status;
          const isRetryableError =
            (err as { isRetryable?: boolean })?.isRetryable ||
            status === 429 ||
            status === 500 ||
            status === 503 ||
            status === 408 ||
            (err as { name?: string })?.name === "TimeoutError";

          // If primary immediately failed with 429/500/503/timeout or other error, trigger fallback immediately
          if (!fallbackStarted) {
            triggerFallback();
          } else if (fallbackFailed && !isSettled) {
            isSettled = true;
            reject(primaryError || fallbackError);
          }
        });
    });

    return result;
  } catch (err: unknown) {
    if (options.throwOnError) {
      throw err instanceof Error ? err : new Error(String(err || "All AI models failed or timed out"));
    }

    console.warn("External AI call failed after hedged fallback model, falling back to demo engine:", err);
    return await callDemoStructured(options);
  }
}
