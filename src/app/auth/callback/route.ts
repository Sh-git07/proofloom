import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearUserContextCache } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/overview";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user already has an organisation
      const { data: member } = await supabase
        .from("organisation_members")
        .select("id")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle();

      if (!member) {
        // Create organisation for the newly confirmed user via secure RPC
        const fullName = data.user.user_metadata?.full_name || "Platform Admin";
        const orgName = data.user.user_metadata?.organisation_name || "My Organisation";

        await supabase.rpc("create_user_organisation", {
          p_full_name: fullName,
          p_org_name: orgName,
        });
      }

      clearUserContextCache();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Redirect to login if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=Email confirmation link expired or invalid.`);
}
