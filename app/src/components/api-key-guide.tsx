"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ChevronDown, ExternalLink, Key, ShieldCheck } from "lucide-react";

export function ApiKeyGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Key className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">How to get an OpenAI API key</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Required for transcription — your key stays in your browser
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-3">
              <ol className="space-y-3 text-[13px] text-muted-foreground">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">1</span>
                  <span>
                    Go to{" "}
                    <a
                      href="https://platform.openai.com/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      platform.openai.com
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    and sign up or log in.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">2</span>
                  <span>
                    Navigate to{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      API Keys
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    in your dashboard.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">3</span>
                  <span>Click <strong className="text-foreground">Create new secret key</strong>, give it a name, and copy the key (starts with <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px]">sk-</code>).</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">4</span>
                  <span>Paste the key above using the <strong className="text-foreground">API key</strong> button, then click <strong className="text-foreground">Save</strong>.</span>
                </li>
              </ol>

              <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/[0.04] px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Your key is private.</strong>{" "}
                  It is stored only in your browser&apos;s localStorage and sent directly to OpenAI for transcription. It is never stored on any server.
                </p>
              </div>

              <p className="mt-3 text-[12px] text-muted-foreground">
                OpenAI charges per minute of audio transcribed. See the Transcription section on the{" "}
                <a
                  href="https://developers.openai.com/api/docs/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  pricing page
                </a>{" "}
                for current Whisper API rates.
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
