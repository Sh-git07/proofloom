import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_DB_PASSWORD: z.string().optional(),
  AI_PROVIDER: z.enum(["gemini", "anthropic", "openai", "demo"]).default("gemini"),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MAX_REQUESTS_PER_USER_PER_HOUR: z.coerce.number().default(30),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DEMO_MODE_ENABLED: z.string().default("true").transform((v) => v === "true" || v === "1"),
  DEMO_PASSWORD: z.string().default("ChangeMe-Demo-2026!"),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export const getEnv = () => {
  if (typeof window === "undefined") {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("❌ Invalid environment variables:", parsed.error.format());
      throw new Error(`Environment variable validation error: ${JSON.stringify(parsed.error.format())}`);
    }
    return parsed.data;
  } else {
    const parsed = clientEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
    if (!parsed.success) {
      console.error("❌ Invalid client environment variables:", parsed.error.format());
      throw new Error(`Client environment variable validation error: ${JSON.stringify(parsed.error.format())}`);
    }
    return parsed.data as unknown as z.infer<typeof serverEnvSchema>;
  }
};

export const env = getEnv();
