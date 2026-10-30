import { AuthControls } from "@/components/AuthControls";
export function ClearanceRequired({ setup = false }: { setup?: boolean }) {
  return (
    <main id="main" className="access-screen">
      <div className="access-mark" aria-hidden="true">
        p.
      </div>
      <p className="eyebrow">Punnett Prompt studio · Restricted access</p>
      <h1>Clearance required.</h1>
      <p>
        {setup
          ? "Your account is signed in. Admin access could not be verified. The database owner must verify the admin API configuration before access is granted."
          : "Access needs a superadmin role and a verified Google sign-in for this session. If your role was just granted or access was updated, sign out and sign in with Google again. Otherwise, contact the database owner."}
      </p>
      <AuthControls signedIn />
    </main>
  );
}
