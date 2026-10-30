import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Access = Awaited<ReturnType<typeof adminAccess>>;
export async function adminAccess() {
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
