"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runStudio } from "@/app/studio-actions";
import { validateChain, type Chain, type Option } from "@/lib/studio";
import { RecordImage } from "./RecordImage";
export function RunPanel({
  chain,
  images,
  runsHref,
}: {
  chain: Chain;
  images: Option[];
  runsHref: string;
}) {
  const [image, setImage] = useState(""),
    [mix, setMix] = useState(false),
    [pending, start] = useTransition(),
    [result, setResult] = useState<{
      ok: boolean;
      message: string;
      id?: string;
    } | null>(null),
    request = useRef<string | null>(null),
    router = useRouter();
  const issue = mix ? null : validateChain(chain);
  return (
    <section className="panel run-panel">
      <p className="eyebrow">Try the sequence</p>
      <h2>Run on an image</h2>
      <p>
        Each step uses the previous output. The final step returns captions.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const form = new FormData(e.currentTarget);
          request.current ??= crypto.randomUUID();
          form.set("request_id", request.current);
          start(async () => {
            try {
              const next = await runStudio(form);
              setResult(next);
              if (next.id || next.ok) request.current = null;
              router.refresh();
            } catch {
              setResult({
                ok: false,
                message:
                  "Connection interrupted. Check run history before trying again.",
              });
            }
          });
        }}
      >
        <fieldset disabled={pending} className="record-fields">
          <input type="hidden" name="chain_id" value={chain.id} />
          <label>
            Source image *
            <select
              name="image_id"
              value={image}
              required
              onChange={(e) => {
                setImage(e.target.value);
                request.current = null;
                setResult(null);
              }}
            >
              <option value="">Choose an image</option>
              {images.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          {image && (
            <RecordImage id={image} large alt="Selected source image" />
          )}
          <label className="checkbox">
            <input
              name="use_mix"
              type="checkbox"
              value="true"
              checked={mix}
              onChange={(e) => {
                setMix(e.target.checked);
                request.current = null;
              }}
            />
            Use prompt chain mix
          </label>
          <small>
            {mix
              ? "Choose a chain randomly using saved relative weights. The run records which chain was selected."
              : "Run the chain shown in this editor."}
          </small>
          {issue && <p className="error">{issue}</p>}
          <button
            type="submit"
            className="button"
            disabled={!!issue || !images.length}
          >
            {pending ? "Running steps…" : "Generate captions"}
          </button>
        </fieldset>
      </form>
      {!images.length && (
        <p>
          No available images.{" "}
          <a
            href="https://punnett-selection.vercel.app/incubator"
            target="_blank"
            rel="noreferrer"
          >
            Upload in the caption studio ↗
          </a>
        </p>
      )}
      <p className="fine">
        The selected image is sent to Gemini. Up to eight steps · ten runs per
        person in 24 hours · no automatic retries.
      </p>
      <div aria-live="polite">
        {pending && (
          <p role="status">
            The chain is running. Saved step outputs will appear in run history.
            This can take a few minutes.
          </p>
        )}
        {result && (
          <p
            className={result.ok ? "success" : "error"}
            role={result.ok ? "status" : "alert"}
          >
            {result.message}{" "}
            {result.id && (
              <Link href={`${runsHref}?q=${result.id}`}>View this run →</Link>
            )}
          </p>
        )}
      </div>
      <Link href={runsHref}>View run history →</Link>
    </section>
  );
}
