import { redirect } from "next/navigation";
import { adminAccess } from "@/lib/admin";
import { AuthControls } from "@/components/AuthControls";
import { ThemeControl } from "@/components/ThemeControl";
import { ClearanceRequired } from "@/components/lab/ClearanceRequired";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return <main id="main" className="access-screen"><p className="eyebrow">Punnett / Prompt studio</p><h1>Connecting the workspace.</h1><p>The prompt studio will be available after its owner finishes the connection settings.</p></main>;
  const access = await adminAccess();
  if (access.state === "admin") redirect("/chains");
  if (access.state !== "visitor")
    return <ClearanceRequired setup={access.state === "setup"} />;
  return (
    <main id="main" className="access-screen studio-welcome">
      <div className="welcome-top">
        <span className="studio-brand">p.</span>
        <ThemeControl />
      </div>
      <p className="eyebrow">Punnett / Prompt studio</p>
      <h1>
        One good prompt.
        <br />
        Then the next.
      </h1>
      <p>
        Build a chain from image to idea to caption. Edit the instructions,
        change the order, and inspect what each step produced.
      </p>
      <ol className="welcome-sequence">
        <li>
          <span>01</span>Describe the image
        </li>
        <li>
          <span>02</span>Find the comic angle
        </li>
        <li>
          <span>03</span>Write the captions
        </li>
      </ol>
      {(await searchParams).auth === "failed" && (
        <p className="error" role="alert">
          Sign-in was not completed. Please try again.
        </p>
      )}
      <AuthControls />
      <p className="fine">Google sign-in · Superadmin access only</p>
    </main>
  );
}
