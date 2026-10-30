import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
export default async function NotFound() {
  await requireAdmin();
  return (
    <main id="main" className="access-screen">
      <h1>This page is off the map.</h1>
      <Link href="/">Return to prompt studio</Link>
    </main>
  );
}
