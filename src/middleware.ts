import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isAuthRoute = path === "/login" || path === "/demo";
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
    path.startsWith("/settings") ||
    path.startsWith("/help");

  // Skip auth checks on non-app/non-auth routes immediately without touching Supabase
  if (!isAuthRoute && !isAppRoute) {
    return NextResponse.next({ request });
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  // If trying to access protected app routes without any auth cookie, redirect immediately
  if (!hasAuthCookie && isAppRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // For RSC / client page transitions where the user has an auth cookie:
  // Bypass external Supabase Auth network call in middleware.
  // The destination Server Component (AppLayout) validates the user and enforces RLS.
  const isRscRequest =
    request.headers.get("rsc") === "1" || request.nextUrl.searchParams.has("_rsc");
  if (isRscRequest && hasAuthCookie && isAppRoute) {
    return NextResponse.next({ request });
  }

  // For non-RSC full page navigations, manage session via @supabase/ssr
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
  } = await supabase.auth.getUser();

  // If trying to access protected app routes without authentication
  if (!user && isAppRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  // If already authenticated and visiting login or demo
  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/overview";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico|css|js)$).*)",
  ],
};
