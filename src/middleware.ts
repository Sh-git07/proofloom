import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Never redirect requests that are going to public, auth, or help pages:
  // /login, /signup, /demo, /help, /, /reset-password, /auth/*, etc.
  const isNeverRedirectRoute =
    path === "/" ||
    path === "/login" ||
    path === "/signup" ||
    path === "/demo" ||
    path === "/reset-password" ||
    path.startsWith("/help") ||
    path.startsWith("/auth/");

  if (isNeverRedirectRoute) {
    return NextResponse.next({ request });
  }

  const isAppRoute =
    path.startsWith("/overview") ||
    path.startsWith("/studio") ||
    path.startsWith("/audits") ||
    path.startsWith("/knowledge") ||
    path.startsWith("/provenance") ||
    path.startsWith("/reviews") ||
    path.startsWith("/drift") ||
    path.startsWith("/insights") ||
    path.startsWith("/team") ||
    path.startsWith("/settings");

  // Non-app routes (e.g. static assets, public endpoints) pass through without redirection
  if (!isAppRoute) {
    return NextResponse.next({ request });
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  // If trying to access protected app routes without any auth cookie, redirect immediately to /login
  if (!hasAuthCookie) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Manage session via @supabase/ssr
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // If session is invalid or user does not exist
  if (!user || authError) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Explicitly delete stale/invalid auth cookies
    request.cookies.getAll().forEach((c) => {
      if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
        redirectResponse.cookies.delete(c.name);
      }
    });
    return redirectResponse;
  }

  // Verify organisation membership
  const { data: member } = await supabase
    .from("organisation_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    // User has no valid organisation membership: redirect to /login and clear cookies
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    request.cookies.getAll().forEach((c) => {
      if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
        redirectResponse.cookies.delete(c.name);
      }
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico|css|js)$).*)",
  ],
};
