"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { editStudio } from "@/app/studio-actions";
import type { Chain, Step, Option } from "@/lib/studio";
export function StudioForm({
  operation,
  chain,
  step,
  base,
  label,
  children,
  createOpen = false,
}: {
  operation: string;
  chain?: Chain;
  step?: Step;
  base: string;
  label: string;
  children?: ReactNode;
  createOpen?: boolean;
}) {
  const [open, setOpen] = useState(createOpen),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    trigger = useRef<HTMLButtonElement>(null),
    router = useRouter();
  const remove = operation.endsWith("delete");
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          setOpen(v);
          setError("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className={
            remove
              ? "text-button danger"
              : operation === "chain.create"
                ? "button"
                : "button secondary"
          }
        >
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog studio-dialog"
          onCloseAutoFocus={(e) => {
            if (trigger.current?.isConnected) {
              e.preventDefault();
              trigger.current.focus();
            }
          }}
        >
          <Dialog.Title>{label}</Dialog.Title>
          <Dialog.Description>
            {remove
              ? `Delete “${step?.name ?? chain?.name}”? ${step ? "The remaining steps will be renumbered." : "Its steps will be deleted. Existing runs keep their prompts and results."} This cannot be undone.`
              : "Save changes to the shared prompt chain. Required fields are marked with *."}
          </Dialog.Description>
          <form
            onChange={() => setError("")}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              start(async () => {
                try {
                  const result = await editStudio(operation, form);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setOpen(false);
                  if (operation === "chain.create")
                    router.push(`${base}?chain=${result.id}`);
                  else if (operation === "chain.delete") router.push(base);
                  router.refresh();
                } catch {
                  setError(
                    "Connection interrupted. Reload to check whether the change completed.",
                  );
                }
              });
            }}
          >
            <input type="hidden" name="chain_id" value={chain?.id ?? ""} />
            <input
              type="hidden"
              name="revision"
              value={chain?.revision ?? ""}
            />
            <input type="hidden" name="step_id" value={step?.id ?? ""} />
            <fieldset disabled={pending} className="record-fields">
              {!remove && children}
            </fieldset>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={pending}
                  className="button secondary"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className={`button ${remove ? "danger" : ""}`}
              >
                {pending
                  ? "Saving…"
                  : remove
                    ? "Confirm delete"
                    : "Save changes"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ChainFields({ chain }: { chain?: Chain }) {
  return (
    <>
      <label>
        Name *
        <input
          aria-label="Name *"
          name="name"
          required
          maxLength={150}
          defaultValue={chain?.name ?? ""}
        />
      </label>
      <label>
        Description
        <textarea
          aria-label="Description"
          name="description"
          maxLength={2000}
          defaultValue={chain?.description ?? ""}
        />
      </label>
      {chain && (
        <label>
          Mix weight *
          <input
            aria-label="Mix weight *"
            name="weight"
            type="number"
            required
            min={0}
            max={10000}
            step="any"
            defaultValue={chain.weight}
          />
          <small>
            Zero excludes this chain. Relative weights are used when you choose
            “Use prompt chain mix”.
          </small>
        </label>
      )}
    </>
  );
}
export function StepFields({
  step,
  models,
  first,
}: {
  step?: Step;
  models: Option[];
  first: boolean;
}) {
  return (
    <>
      <label>
        Step name *
        <input
          aria-label="Step name *"
          name="name"
          required
          maxLength={100}
          defaultValue={step?.name ?? ""}
        />
      </label>
      <div className="field-pair">
        <label>
          Input *
          <select
            aria-label="Input *"
            name="input_kind"
            defaultValue={step?.input_kind ?? (first ? "image" : "previous")}
          >
            <option value="image">Source image</option>
            <option value="previous">Previous step output</option>
          </select>
        </label>
        <label>
          Output *
          <select
            aria-label="Output *"
            name="output_kind"
            defaultValue={step?.output_kind ?? "text"}
          >
            <option value="text">Text</option>
            <option value="captions">Caption list (2–6)</option>
          </select>
        </label>
      </div>
      <label>
        System prompt
        <textarea
          aria-label="System prompt"
          name="system_prompt"
          rows={4}
          maxLength={12000}
          defaultValue={step?.system_prompt ?? ""}
        />
        <small>The standing instructions for this step.</small>
      </label>
      <label>
        User prompt *
        <textarea
          aria-label="User prompt *"
          name="user_prompt"
          rows={6}
          required
          maxLength={12000}
          defaultValue={step?.user_prompt ?? ""}
        />
        <small>
          The image or previous step output is attached automatically. No
          template variables are needed.
        </small>
      </label>
      <div className="field-pair">
        <label>
          Model *
          <select
            aria-label="Model *"
            name="model_id"
            required
            defaultValue={step?.model_id ?? models[0]?.id ?? ""}
          >
            <option value="" disabled>
              Choose a model
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Temperature *
          <input
            aria-label="Temperature *"
            name="temperature"
            type="number"
            required
            min={0}
            max={2}
            step={0.1}
            defaultValue={step?.temperature ?? 0.7}
          />
        </label>
      </div>
    </>
  );
}
export function MoveStep({ chain, step }: { chain: Chain; step: Step }) {
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    router = useRouter();
  function move(position: number) {
    const form = new FormData();
    form.set("chain_id", chain.id);
    form.set("revision", String(chain.revision));
    form.set("step_id", step.id);
    form.set("position", String(position));
    start(async () => {
      try {
        const result = await editStudio("step.move", form);
        if (!result.ok) setError(result.message);
        else {
          setError("");
          router.refresh();
        }
      } catch {
        setError("Order could not be saved. Reload to check it.");
      }
    });
  }
  return (
    <div className="step-move">
      <button
        type="button"
        className="text-button"
        aria-label={`Move ${step.name} up`}
        disabled={pending || step.position === 1}
        onClick={() => move(step.position - 1)}
      >
        ↑ Move up
      </button>
      <button
        type="button"
        className="text-button"
        aria-label={`Move ${step.name} down`}
        disabled={pending || step.position === chain.steps.length}
        onClick={() => move(step.position + 1)}
      >
        ↓ Move down
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
