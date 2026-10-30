import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Access = Awaited<ReturnType<typeof adminAccess>>;
export async function adminAccess() {
  // Fail closed before creating a client when an owner has not configured
  // the new project yet. This also keeps framework error-page builds safe.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return { state: "setup" as const, client: null, user: null };
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return { state: "visitor" as const, client, user: null };
  const role = await client.rpc("punnett_admin_access");
  if (role.error) return { state: "setup" as const, client, user: data.user };
  return {
    state: role.data === true ? ("admin" as const) : ("denied" as const),
    client,
    user: data.user,
  };
}
export async function requireAdmin() {
  const access = await adminAccess();
  if (access.state !== "admin" || !access.user) redirect("/");
  return { client: access.client, user: access.user };
}
