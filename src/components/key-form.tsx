"use client";

import { useAction } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PROVIDER_INFO, type Provider } from "@/lib/providers";
import { Button, inputClass, Notice } from "./ui";

export function KeyForm({
  workspaceId,
  provider,
  submitLabel = "Save key",
  onSaved,
}: {
  workspaceId: Id<"workspaces">;
  provider: Provider;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const save = useAction(api.secrets.saveProviderKey);
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = PROVIDER_INFO[provider];
  const inputId = `key-${provider}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await save({ workspaceId, provider, apiKey });
      if (result.ok) {
        setApiKey("");
        onSaved?.();
      } else {
        setError(result.message);
      }
    } catch {
      setError("The key was not saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-[14px] font-medium">
          {info.name} API key
        </label>
        <a
          href={info.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
        >
          Get a key from {info.keySite}
          <ArrowUpRight size={12} strokeWidth={1.75} />
        </a>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={info.placeholder}
          className={`${inputClass} font-mono`}
        />
        <Button type="submit" size="md" disabled={pending || apiKey.trim() === ""}>
          {pending ? "Checking key" : submitLabel}
        </Button>
      </div>
      <p className="text-[12px] text-muted">
        opentopost checks the key with {info.name}, encrypts it, and never shows it again.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}
