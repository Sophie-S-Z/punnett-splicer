import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { UUID, type Chain, type Run, type Option } from "@/lib/studio";
import { StudioForm, ChainFields, StepFields, MoveStep } from "./StudioForms";
import { RunPanel } from "./RunPanel";
import { RecordImage } from "./RecordImage";
import { Shell } from "./Shell";
type Query = Record<string, string | string[] | undefined>;
export async function StudioPage({
  query,
  mode = "chains",
  runsHref = "/runs",
}: {
  query: Query;
  mode?: "chains" | "runs" | "mix";
  runsHref?: string;
}) {
  const { client } = await requireAdmin(),
    base = "/chains";
  const q = typeof query.q === "string" ? query.q.slice(0, 200) : "",
    size = [10, 25, 50, 100].includes(Number(query.size))
      ? Number(query.size)
      : 25;
  let page = Math.max(
    1,
    Math.min(
      10000,
      Number.isSafeInteger(Number(query.page)) ? Number(query.page) : 1,
    ),
  );
  const kind = mode === "runs" ? "runs" : "chains",
    chainId =
      typeof query.chain === "string" && UUID.test(query.chain)
        ? query.chain
        : null;
  const read = async (p: number) =>
    client
      .rpc(
        "punnett_studio_page",
        {
          kind_input: kind,
          search_input: q,
          chain_input: mode === "runs" ? chainId : null,
        },
        { count: "exact" },
      )
      .range((p - 1) * size, p * size - 1);
  let result = await read(page);
  if (result.status === 416) {
    page = 1;
    result = await read(page);
  }
  if (result.error || result.count === null)
    throw new Error(
      "The prompt studio could not be loaded. Check the database setup and reload.",
    );
  const total = result.count,
    last = Math.max(1, Math.ceil(total / size));
  if (page > last) {
    page = last;
    result = await read(page);
    if (result.error)
      throw new Error("The prompt studio page could not be loaded.");
  }
  const rows = result.data ?? [];
  let selected: Chain | null = null;
  if (mode !== "runs" && (chainId || rows[0]?.id)) {
    const response = await client.rpc("punnett_studio_chain", {
      id_input: chainId ?? rows[0].id,
    });
    if (response.error)
      throw new Error("This chain could not be read. Reload and try again.");
    selected = response.data;
  }
  const options: Record<string, Option[]> = { models: [], images: [] };
  if (selected)
    for (const entity of ["models", "images"]) {
      for (let offset = 0; ; offset += 200) {
        const r = await client
          .rpc(
            "punnett_admin_records",
            { kind_input: entity, sort_input: "name" },
            { count: "exact" },
          )
          .range(offset, offset + 199);
        if (r.error || r.count === null)
          throw new Error("The model or image catalog could not be loaded.");
        for (const item of r.data) {
          const row = item.record;
          if (entity === "models")
            options.models.push({ id: row.id, label: row.name });
          else if (
            !row.archived &&
            row.status === "completed" &&
            row.storage_path
          )
            options.images.push({
              id: row.id,
              label:
                row.title ||
                `Image · ${new Date(row.created_at).toISOString().slice(0, 10)} · ${row.id.slice(0, 6)}`,
            });
        }
        if (offset + r.data.length >= r.count) break;
        if (!r.data.length)
          throw new Error("The reference catalog was incomplete.");
      }
    }
  const title =
    mode === "runs"
      ? "Run history"
      : mode === "mix"
        ? "Prompt chain mix"
        : "Pipeline studio";
  const href = (p: number) =>
    `?${new URLSearchParams({ q, size: String(size), page: String(p), ...(chainId ? { chain: chainId } : {}) })}`;
  return (
    <Shell title={title}>
      <main id="main" className="page-content studio-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Prompt chains</p>
            <h1>{title}</h1>
            <p>
              {mode === "runs"
                ? "Real provider outputs, with the prompts and order used for each run."
                : mode === "mix"
                  ? "Set relative weights, then choose “Use prompt chain mix” when generating. Zero excludes a chain."
                  : "Build a sequence. Read its prompts. See what each step produces."}
            </p>
          </div>
          {mode !== "runs" && (
            <StudioForm
              key={`create-${query.create}`}
              createOpen={query.create === "true"}
              operation="chain.create"
              base={base}
              label="Create prompt chain"
            >
              <ChainFields />
            </StudioForm>
          )}
        </div>
        <nav className="studio-tabs" aria-label="Prompt studio">
          <Link
            href="/chains"
            aria-current={mode === "chains" ? "page" : undefined}
          >
            Chains & steps
          </Link>
          <Link href="/mix" aria-current={mode === "mix" ? "page" : undefined}>
            Mix
          </Link>
          <Link
            href={runsHref}
            aria-current={mode === "runs" ? "page" : undefined}
          >
            Run history
          </Link>
        </nav>
        <form className="table-controls" method="get">
          <label className="search-field">
            Search {mode === "runs" ? "runs" : "chains"}
            <input
              name="q"
              defaultValue={q}
              maxLength={200}
              placeholder="Name, description, or ID…"
            />
          </label>
          <label>
            Rows
            <select name="size" defaultValue={size}>
              {[10, 25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="button secondary">Search</button>
          {q && (
            <Link
              href={mode === "runs" ? runsHref : mode === "mix" ? "/mix" : base}
            >
              Clear search
            </Link>
          )}
        </form>
        {mode === "runs" ? (
          <div className="run-list">
            {rows.map(({ record: r }: { record: Run }) => (
              <article className="panel run-record" key={r.id}>
                <div>
                  <span className={`badge ${r.status}`}>
                    {r.status === "pending" ? "Pending / incomplete" : r.status}
                  </span>
                  <h2>{r.snapshot.name}</h2>
                  <time>
                    {new Date(r.created_at).toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                  <p className="fine">
                    Run {r.id} · chain revision {r.snapshot.revision}
                  </p>
                  {r.chain_id && (
                    <Link href={`${base}?chain=${r.chain_id}`}>
                      Open current chain →
                    </Link>
                  )}
                </div>
                <RecordImage id={r.image_id} large />
                <div className="run-trace">
                  {r.snapshot.steps.map((s) => {
                    const output = r.outputs.find(
                      (o) => o.position === s.position,
                    );
                    return (
                      <section key={s.id}>
                        <h3>
                          {s.position}. {s.name}
                        </h3>
                        <p className="fine">
                          {s.model} ·{" "}
                          {output
                            ? `${(output.duration_ms / 1000).toFixed(1)} seconds`
                            : "No saved output"}
                        </p>
                        {Array.isArray(output?.output) ? (
                          <ol className="caption-results">
                            {output.output.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ol>
                        ) : (
                          output && (
                            <p className="trace-text">{output.output}</p>
                          )
                        )}
                        <details>
                          <summary>View exact prompts & settings</summary>
                          <p>
                            <strong>System prompt</strong>
                          </p>
                          <pre>{s.system_prompt || "(none)"}</pre>
                          <p>
                            <strong>User prompt</strong>
                          </p>
                          <pre>{s.user_prompt}</pre>
                          <p className="fine">
                            {s.input_kind === "image"
                              ? "Image"
                              : "Previous output"}{" "}
                            → {s.output_kind} · temperature {s.temperature}
                          </p>
                        </details>
                      </section>
                    );
                  })}
                  {r.error && (
                    <p className="error" role="status">
                      {r.error}
                    </p>
                  )}
                </div>
              </article>
            ))}
            {!rows.length && (
              <div className="empty-state">
                <h2>No runs found.</h2>
                <p>
                  Generate captions from a chain to save its prompts and outputs
                  here.
                </p>
                <Link href={base}>Open the editor →</Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="chain-list" aria-label="Prompt chain list">
              {rows.map(({ record: c }: { record: Chain }) => (
                <Link
                  href={`${mode === "mix" ? "/mix" : base}?chain=${c.id}&page=${page}&size=${size}&q=${encodeURIComponent(q)}`}
                  key={c.id}
                  className={`chain-card ${selected?.id === c.id ? "selected" : ""}`}
                  aria-current={selected?.id === c.id ? "true" : undefined}
                >
                  <h2>{c.name}</h2>
                  <p>{c.description}</p>
                  <small>
                    {c.step_count} steps · weight {c.weight}
                    {c.example ? " · Example starter" : ""}
                  </small>
                </Link>
              ))}
            </div>
            {!rows.length && (
              <div className="empty-state">
                <h2>
                  {q
                    ? "No matching chains."
                    : "Create your first prompt chain."}
                </h2>
                <p>
                  {q
                    ? "Try a different search."
                    : "Add an image step, then pass its output through later steps."}
                </p>
              </div>
            )}
            {chainId && !selected && (
              <p role="status">
                That chain no longer exists. Choose another chain.
              </p>
            )}
            {selected && (
              <div className="editor-layout">
                <section className="chain-editor">
                  <header className="editor-heading">
                    <div>
                      <p className="eyebrow">
                        {selected.example ? "Example starter" : "Prompt chain"}{" "}
                        · revision {selected.revision}
                      </p>
                      <h2>{selected.name}</h2>
                      <p>{selected.description}</p>
                    </div>
                    <div className="row-actions">
                      <StudioForm
                        operation="chain.update"
                        chain={selected}
                        base={base}
                        label="Edit chain"
                      >
                        <ChainFields chain={selected} />
                      </StudioForm>
                      <StudioForm
                        operation="chain.delete"
                        chain={selected}
                        base={base}
                        label="Delete chain"
                      />
                    </div>
                  </header>
                  <ol className="step-sequence">
                    {selected.steps.map((step) => (
                      <li key={step.id} className="step-card">
                        <div className="step-heading">
                          <span
                            className="step-number"
                            aria-label={`Step ${step.position}`}
                          >
                            {String(step.position).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{step.name}</h3>
                            <p className="fine">
                              {step.input_kind === "image"
                                ? "Source image"
                                : "Previous step output"}{" "}
                              →{" "}
                              {step.output_kind === "captions"
                                ? "Caption list"
                                : "Text"}{" "}
                              · {step.model}
                            </p>
                          </div>
                          <StudioForm
                            operation="step.update"
                            chain={selected}
                            step={step}
                            base={base}
                            label={`Edit step ${step.position}`}
                          >
                            <StepFields
                              step={step}
                              models={options.models}
                              first={step.position === 1}
                            />
                          </StudioForm>
                        </div>
                        <dl className="prompt-text">
                          <div>
                            <dt>System prompt</dt>
                            <dd>{step.system_prompt || "No system prompt"}</dd>
                          </div>
                          <div>
                            <dt>User prompt</dt>
                            <dd>{step.user_prompt}</dd>
                          </div>
                        </dl>
                        <div className="step-footer">
                          <MoveStep chain={selected} step={step} />
                          <StudioForm
                            operation="step.delete"
                            chain={selected}
                            step={step}
                            base={base}
                            label={`Delete step ${step.position}`}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                  {selected.steps.length < 8 && (
                    <StudioForm
                      operation="step.create"
                      chain={selected}
                      base={base}
                      label="Add step"
                    >
                      <StepFields
                        models={options.models}
                        first={!selected.steps.length}
                      />
                    </StudioForm>
                  )}
                  {!selected.steps.length && (
                    <p>
                      Add a step that takes an image. Set the final step to
                      output a caption list.
                    </p>
                  )}
                </section>
                <RunPanel
                  key={selected.id}
                  chain={selected}
                  images={options.images}
                  runsHref={runsHref}
                />
              </div>
            )}
          </>
        )}
        <div className="pagination">
          <p>
            {total
              ? `${(page - 1) * size + 1}–${Math.min(page * size, total)}`
              : "0"}{" "}
            of {total} {mode === "runs" ? "runs" : "chains"}
          </p>
          <nav aria-label="Pagination">
            {page > 1 ? (
              <Link href={href(page - 1)}>← Previous</Link>
            ) : (
              <span>← Previous</span>
            )}
            <span>
              Page {page} of {last}
            </span>
            {page < last ? (
              <Link href={href(page + 1)}>Next →</Link>
            ) : (
              <span>Next →</span>
            )}
          </nav>
        </div>
      </main>
    </Shell>
  );
}
