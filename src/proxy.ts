import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const finish = (result: NextResponse) => {
    for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
    result.headers.set("X-Content-Type-Options", "nosniff");
    result.headers.set("Referrer-Policy", "same-origin");
    return result;
  };
  const pathname = request.nextUrl.pathname;
  const authEntry = pathname === "/" || pathname === "/auth/callback";
  try {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values) {
            for (const { name, value } of values)
              request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of values)
              response.cookies.set(name, value, options);
          },
        },
      },
    );
    const { data, error } = await client.auth.getUser();
    if (authEntry) return finish(response);
    const role =
      !error && data.user ? await client.rpc("punnett_admin_access") : null;
    if (role && !role.error && role.data === true) return finish(response);
  } catch {
    /* Fail closed if auth or role verification is unavailable. */
  }
  if (authEntry) return finish(response);
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/asset/")
  )
    return finish(
      NextResponse.json(
        { error: "Google superadmin access required." },
        { status: 403 },
      ),
    );
  return finish(NextResponse.redirect(new URL("/", request.url)));
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.png).*)",
  ],
};
