import Link from "next/link";
import { AuthControls } from "./AuthControls";
import { ThemeControl } from "./ThemeControl";
import { StudioSearch } from "./StudioSearch";
export function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <>
      <header className="studio-topbar">
        <Link href="/chains" className="studio-brand">
          <span aria-hidden="true">p.</span>
          <div>
            Punnett<small>PROMPT STUDIO</small>
          </div>
        </Link>
        <p className="studio-breadcrumb">{title}</p>
        <StudioSearch />
        <ThemeControl />
        <AuthControls signedIn />
      </header>
      {children}
      <footer className="studio-footer">
        <span>Google login · Superadmin workspace</span>
        <a
          href="https://punnett-observatory.vercel.app"
          target="_blank"
          rel="noreferrer"
        >
          Open admin panel ↗
        </a>
        <a
          href="https://punnett-selection.vercel.app"
          target="_blank"
          rel="noreferrer"
        >
          Open caption studio ↗
        </a>
      </footer>
    </>
  );
}
