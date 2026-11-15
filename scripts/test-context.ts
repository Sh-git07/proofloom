import { createServerClient } from "@supabase/ssr";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

async function test() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin.demo@example.com",
    password: process.env.DEMO_PASSWORD || "ChangeMe-Demo-2026!",
  });
  console.log("Auth error:", authErr);
  console.log("User id:", auth.user?.id);

  const [profileRes, memberRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", auth.user!.id)
      .single(),
    supabase
      .from("organisation_members")
      .select("organisation_id, role, organisations(id, name, slug, is_demo)")
      .eq("user_id", auth.user!.id)
      .limit(1)
      .single(),
  ]);

  console.log("Profile res:", profileRes);
  console.log("Member res:", memberRes);
}

test();
