"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function AuthControls({ signedIn = false }: { signedIn?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  async function run() {
    setBusy(true);
    setError("");
    try {
      const client = createClient();
      if (signedIn) {
        const result = await client.auth.signOut({ scope: "local" });
        if (result.error) throw result.error;
        router.replace("/");
        router.refresh();
        setBusy(false);
      } else {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: new URL("/auth/callback", location.origin).toString(),
            skipBrowserRedirect: true,
          },
        });
        if (error || !data.url) throw new Error();
        location.assign(data.url);
      }
    } catch {
      setError(
        signedIn
          ? "Sign-out failed. Try again."
          : "Google sign-in could not start. Try again.",
      );
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="button" onClick={() => void run()} disabled={busy}>
        {busy ? "One moment…" : signedIn ? "Sign out" : "Sign in with Google"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
