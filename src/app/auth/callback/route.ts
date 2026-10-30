import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  if (code && !url.searchParams.has("error"))
    try {
      const client = await createClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        if (data.session?.provider_token) {
          // Google validates the token in the database; no provider/signup label is trusted.
          // Nonadmins still reach the normal clearance screen. No token is persisted here.
          const verification = await client.rpc(
            "punnett_verify_google_session",
            {
              google_access_token: data.session.provider_token,
            },
          );
          if (verification.error)
            throw new Error("Google verification unavailable.");
        }
        const response = NextResponse.redirect(new URL("/", url.origin));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    } catch {
      /* Offer a recoverable error. */
    }
  const response = NextResponse.redirect(new URL("/?auth=failed", url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
