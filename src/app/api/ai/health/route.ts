import { NextResponse } from "next/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";

export async function GET() {
  const startTime = Date.now();
  const modelName = process.env.AI_MODEL || "gemini-3.8-flash";
  const provider = process.env.AI_PROVIDER || "gemini";
  const apiKey = process.env.GEMINI_API_KEY;

  if (provider === "demo") {
    return NextResponse.json({
      model: modelName,
      provider: "demo",
      status: "DEMO_MODE",
      httpStatus: 200,
      latencyMs: 0,
      message: "Demo analysis mode active (deterministic offline rules).",
      isHealthy: true,
      lastChecked: new Date().toISOString(),
    });
  }

  if (!apiKey || apiKey.length < 5) {
    return NextResponse.json({
      model: modelName,
      provider: "gemini",
      status: "KEY_MISSING",
      httpStatus: 0,
      latencyMs: 0,
      message: "GEMINI_API_KEY is not configured.",
      isHealthy: false,
      lastChecked: new Date().toISOString(),
    });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });

    const latencyMs = Date.now() - startTime;
    const httpStatus = response.status;

    // Structured server log without secrets or user content
    console.log(
      JSON.stringify({
        tag: "GEMINI_SERVER_LOG",
        task: "health_check",
        model: modelName,
        httpStatus,
        latencyMs,
        zodValidation: true,
      })
    );

    if (httpStatus === 200) {
      return NextResponse.json({
        model: modelName,
        provider: "gemini",
        status: "HEALTHY",
        httpStatus: 200,
        latencyMs,
        message: "Model is operational and accepting live audit requests.",
        isHealthy: true,
        lastChecked: new Date().toISOString(),
      });
    }

    const errJson = await response.json().catch(() => null);
    const errMsg = errJson?.error?.message || `HTTP ${httpStatus}`;

    if (httpStatus === 404) {
      return NextResponse.json({
        model: modelName,
        provider: "gemini",
        status: "RETIRED",
        httpStatus: 404,
        latencyMs,
        message: errMsg || "Model is retired or unavailable. Update AI_MODEL in environment variables.",
        isHealthy: false,
        lastChecked: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      model: modelName,
      provider: "gemini",
      status: "ERROR",
      httpStatus,
      latencyMs,
      message: errMsg,
      isHealthy: false,
      lastChecked: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({
        tag: "GEMINI_SERVER_LOG",
        task: "health_check",
        model: modelName,
        httpStatus: 0,
        latencyMs,
        zodValidation: false,
        error: msg,
      })
    );

    return NextResponse.json({
      model: modelName,
      provider: "gemini",
      status: "NETWORK_ERROR",
      httpStatus: 0,
      latencyMs,
      message: `Failed to connect to Gemini API: ${msg}`,
      isHealthy: false,
      lastChecked: new Date().toISOString(),
    });
  }
}
