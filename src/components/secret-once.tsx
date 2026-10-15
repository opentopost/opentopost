"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Shows a secret once, with a copy button. */
export function SecretOnce({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-item border border-accent/40 bg-accent-soft/40 p-3">
      <p className="text-[13px] text-ink">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[6px] bg-surface px-2 py-1.5 font-mono text-[12px]">{value}</code>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-surface px-2 py-1.5 text-[12px]"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
