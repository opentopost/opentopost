"use client";

import { isManager } from "@/lib/roles";
import { ChevronDown, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyForm } from "@/components/key-form";
import { IconTile } from "@/components/mark";
import { Card, inputClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { PROVIDER_INFO, type Provider } from "@/lib/providers";

const OTHERS: Provider[] = ["anthropic", "openai", "openrouter"];

export default function Onboarding() {
  const router = useRouter();
  const { workspace, member } = useWorkspace();
  const [other, setOther] = useState<Provider>("anthropic");
  const done = () => router.push("/dashboard");

  if (!isManager(member.role)) {
    return <p className="text-muted">The workspace owner adds the model key.</p>;
  }

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pt-4 md:pt-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <IconTile tone="accent" size={48}>
          <KeyRound size={20} strokeWidth={1.75} />
        </IconTile>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.02em]">Add a model key</h1>
        <p className="max-w-[440px] text-[14px] text-muted">
          opentopost runs on your own model key, so the app is free. Gemini has a free tier, so start
          there.
        </p>
      </div>

      <Card className="p-5">
        <KeyForm workspaceId={workspace._id} provider="google" submitLabel="Save and continue" onSaved={done} />
      </Card>

      <details className="group rounded-card border border-line">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-[14px] font-medium">
          Use another provider
          <ChevronDown size={16} strokeWidth={1.75} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-line p-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="other-provider" className="text-[14px] font-medium">
              Provider
            </label>
            <select
              id="other-provider"
              value={other}
              onChange={(event) => setOther(event.target.value as Provider)}
              className={`${inputClass} sm:max-w-[240px]`}
            >
              {OTHERS.map((provider) => (
                <option key={provider} value={provider}>
                  {PROVIDER_INFO[provider].name}
                </option>
              ))}
            </select>
          </div>
          <KeyForm key={other} workspaceId={workspace._id} provider={other} submitLabel="Save and continue" onSaved={done} />
        </div>
      </details>
    </div>
  );
}
