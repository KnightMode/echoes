"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

type LibraryStorageHintProps = Readonly<{
  /** Slightly smaller icon in tight headers */
  size?: "sm" | "md";
}>;

export function LibraryStorageHint({ size = "md" }: LibraryStorageHintProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    globalThis.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      globalThis.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const iconClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div className="relative inline-flex shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-expanded={open}
        aria-describedby={open ? descriptionId : undefined}
        aria-label="Where your library is stored"
      >
        <CircleHelp className={iconClass} aria-hidden />
      </button>
      {open && (
        <div
          id={descriptionId}
          role="tooltip"
          className="absolute right-0 top-full z-[60] mt-1.5 w-[min(19rem,calc(100vw-2.5rem))] rounded-lg border border-border bg-popover px-3 py-2.5 text-[11px] leading-relaxed text-popover-foreground shadow-lg"
        >
          <p className="font-medium text-foreground">Everything stays on your computer</p>
          <p className="mt-1.5 text-muted-foreground">
            Echoes saves your library only in the folder you pick:{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
              library.json
            </code>{" "}
            (transcripts and folders) and an{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px]">
              audio/
            </code>{" "}
            folder for recordings. Nothing is stored on Echoes servers or in the cloud—only on
            your file system. Your OpenAI API key stays in the browser for transcription requests.
          </p>
        </div>
      )}
    </div>
  );
}
