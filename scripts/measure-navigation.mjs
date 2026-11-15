import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = "admin.demo@example.com";
const password = process.env.DEMO_PASSWORD || "ChangeMe-Demo-2026!";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const cookieJar = new Map();

const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
  cookies: {
    getAll() {
      return Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => cookieJar.set(name, value));
    },
  },
});

async function run() {
  console.log("Signing in as admin with @supabase/ssr...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    console.error("Login failed:", error?.message);
    process.exit(1);
  }

  console.log("Cookies set:", Array.from(cookieJar.keys()));
  const cookieHeader = Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  const routes = ["/overview", "/studio", "/audits", "/reviews"];

  console.log("\nWarming up connection...");
  await fetch("http://localhost:3000/overview", { headers: { Cookie: cookieHeader } });

  console.log("\n--- Starting Measured Page Navigation ---");
  for (const route of routes) {
    const start = performance.now();
    const res = await fetch(`http://localhost:3000${route}`, {
      headers: {
        Cookie: cookieHeader,
      },
      redirect: "manual",
    });
    const duration = performance.now() - start;
    console.log(`[STATUS ${res.status}] ${route} took ${duration.toFixed(2)}ms`);
    if (res.status === 307 || res.status === 302) {
      console.log(`  -> Redirected to: ${res.headers.get("location")}`);
    }
  }
}

run();
