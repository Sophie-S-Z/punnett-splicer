"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="access-screen">
      <p className="eyebrow">Connection interrupted</p>
      <h1>The view could not load.</h1>
      <p>
        Check your connection and try again. If the problem continues, ask the
        database owner to verify the admin API configuration.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <Link href="/">Return to prompt studio</Link>
    </main>
  );
}
