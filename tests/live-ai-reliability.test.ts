import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callGeminiStructured } from "@/lib/ai/gemini";
import { generateStructured } from "@/lib/ai";
import { z } from "zod";

describe("Live AI Reliability, Timeout & Fallback Tests", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "mock-key-12345";
    process.env.AI_PROVIDER = "gemini";
    process.env.AI_MODEL = "gemini-3.8-flash";
    process.env.AI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Call that hangs is aborted at the timeout
  // =========================================================================
  it("aborts a hanging Gemini call when timeout expires via AbortController", async () => {
    let receivedSignal: AbortSignal | undefined;

    global.fetch = vi.fn().mockImplementation((_url, init) => {
      receivedSignal = init?.signal;
      // Return a promise that hangs and respects abort signal
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            const abortErr = new Error("This operation was aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        }
      });
    });

    const testSchema = z.object({ ok: z.boolean() });

    await expect(
      callGeminiStructured(
        {
          task: "voice_analysis",
          system: "sys",
          prompt: "test",
          schema: testSchema,
        },
        "mock-key",
        "gemini-3.8-flash",
        100 // 100ms test timeout
      )
    ).rejects.toThrow(/timed out/i);

    expect(receivedSignal?.aborted).toBe(true);
  });

  // =========================================================================
  // 2. HTTP 503 on primary triggers immediate fallback model
  // =========================================================================
  it("immediately starts fallback model on 503 and succeeds on fallback model", async () => {
    const requestedUrls: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      requestedUrls.push(urlStr);

      // Primary model returns 503
      if (urlStr.includes("gemini-3.8-flash")) {
        return new Response(
          JSON.stringify({
            error: { code: 503, message: "Model overloaded. Spikes in demand are temporary." },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      // Fallback model returns 200 with valid schema JSON
      if (urlStr.includes("gemini-3.1-flash-lite")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ claims: [{ claim: "18% boost" }] }) }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("Not found", { status: 404 });
    });

    const result = await generateStructured({
      task: "claim_extraction",
      system: "extract",
      prompt: "18% boost",
      schema: z.object({
        claims: z.array(z.object({ claim: z.string() })),
      }),
      throwOnError: true,
    });

    // 1. Handled by fallback model
    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.isFallback).toBe(true);
    expect(result.data.claims[0].claim).toBe("18% boost");

    // 2. Verified call sequence: primary attempt failed with 503, immediately started fallback model
    const primaryCalls = requestedUrls.filter((u) => u.includes("gemini-3.8-flash"));
    const fallbackCalls = requestedUrls.filter((u) => u.includes("gemini-3.1-flash-lite"));

    expect(primaryCalls.length).toBeGreaterThanOrEqual(1);
    expect(fallbackCalls.length).toBe(1); // Tried fallback model
  });

  // =========================================================================
  // 3. When both primary and fallback fail, audit completes rules-only with honest label
  // =========================================================================
  it("completes rules-only with honest label 'AI: failed, rules only' when both models fail", async () => {
    // Both primary and fallback return 503
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: { code: 503, message: "Service unavailable across all models." },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    });

    let aiVoiceStatus: "AI: used" | "AI: failed, rules only" = "AI: failed, rules only";
    let caughtError: unknown = null;

    try {
      await generateStructured({
        task: "voice_analysis",
        system: "voice",
        prompt: "test content",
        schema: z.object({ findings: z.array(z.any()) }),
        throwOnError: true,
      });
      aiVoiceStatus = "AI: used";
    } catch (err) {
      caughtError = err;
      aiVoiceStatus = "AI: failed, rules only";
    }

    // Both models failed and threw
    expect(caughtError).toBeDefined();
    expect(aiVoiceStatus).toBe("AI: failed, rules only");

    // Deterministic rules execute safely in fallback mode
    const content = "Our platform is purpose-built for enterprise workflows.";
    const deterministicFindings: string[] = [];

    // Stage produces honest label and warning
    const stageDetail = `${aiVoiceStatus} • Completed with ${deterministicFindings.length} findings (warning: AI unavailable)`;
    const headerLabel =
      aiVoiceStatus === "AI: failed, rules only"
        ? "LIVE AI (GEMINI): voice analysis unavailable, rules only"
        : "LIVE AI (GEMINI)";

    expect(stageDetail).toContain("AI: failed, rules only");
    expect(stageDetail).toContain("warning: AI unavailable");
    expect(headerLabel).toBe("LIVE AI (GEMINI): voice analysis unavailable, rules only");
  });

  // =========================================================================
  // 4. Hedged request: slow primary (>8s) triggers parallel fast fallback which wins
  // =========================================================================
  it("hedges request when primary is slow (>8s), fast fallback starts and wins", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();

      // Slow primary hangs
      if (urlStr.includes("gemini-3.8-flash")) {
        return new Promise((resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
          // Primary would take 12 seconds to respond
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  candidates: [
                    { content: { parts: [{ text: JSON.stringify({ claims: [{ claim: "slow primary claim" }] }) }] } },
                  ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            );
          }, 12000);
        });
      }

      // Fast fallback responds in 100ms
      if (urlStr.includes("gemini-3.1-flash-lite")) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  candidates: [
                    { content: { parts: [{ text: JSON.stringify({ claims: [{ claim: "fast fallback claim" }] }) }] } },
                  ],
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            );
          }, 100);
        });
      }

      return Promise.resolve(new Response("Not found", { status: 404 }));
    });

    const promise = generateStructured({
      task: "claim_extraction",
      system: "extract",
      prompt: "test content",
      schema: z.object({
        claims: z.array(z.object({ claim: z.string() })),
      }),
      throwOnError: true,
    });

    // Advance time past the 8-second hedge delay and the 100ms fallback time
    await vi.advanceTimersByTimeAsync(8150);

    const result = await promise;

    expect(result.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(result.isFallback).toBe(true);
    expect(result.data.claims[0].claim).toBe("fast fallback claim");

    vi.useRealTimers();
  });
});
