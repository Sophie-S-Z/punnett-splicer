"use client";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function StudioSearch() {
  const [open, setOpen] = useState(false),
    router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={() => setOpen(true)}
        aria-label="Jump to a page"
      >
        Jump to… <kbd>⌘ K</kbd>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Jump to a page"
        overlayClassName="dialog-overlay"
        contentClassName="command-dialog"
      >
        <Command.Input placeholder="Find a page or action…" />
        <Command.List>
          <Command.Empty>No matching pages.</Command.Empty>
          {[
            ["Chains & steps", "/chains"],
            ["Prompt chain mix", "/mix"],
            ["Run history", "/runs"],
            ["Create prompt chain", "/chains?create=true"],
          ].map(([label, path]) => (
            <Command.Item
              key={path}
              value={label}
              onSelect={() => {
                setOpen(false);
                router.push(path);
              }}
            >
              {label}
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
