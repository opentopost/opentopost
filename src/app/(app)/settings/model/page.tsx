"use client";

import { isManager } from "@/lib/roles";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { KeyForm } from "@/components/key-form";
import { Badge, Button, Card, inputClass, Notice } from "@/components/ui";
import { useWorkspace, type Current } from "@/components/workspace";
import { SkeletonList } from "@/components/loader";
import {
  PROVIDERS,
  PROVIDER_INFO,
  TASKS,
  TASK_INFO,
  type Provider,
  type Task,
} from "@/lib/providers";

type KeyRow = {
  provider: string;
  last4: string;
  testedAt: number | null;
  testOk: boolean | null;
  testMessage: string | null;
};

type ModelRow = { provider: Provider; task: Task; modelId: string | null };

function TaskModels({
  workspace,
  provider,
  rows,
}: {
  workspace: Current["workspace"];
  provider: Provider;
  rows: ModelRow[];
}) {
  const listModels = useAction(api.secrets.listModels);
  const setModel = useMutation(api.modelConfig.setModel);
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listModels({ workspaceId: workspace._id, provider })
      .then((list) => !cancelled && setModels(list))
      .catch(() => !cancelled && setError("The model list did not load. Test the key, then reload."));
    return () => {
      cancelled = true;
    };
  }, [listModels, workspace._id, provider]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!models) return <SkeletonList label="Loading models" rows={2} compact />;

  return (
    <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
      {TASKS.map((task) => {
        const current = rows.find((row) => row.task === task)?.modelId ?? null;
        const missing = current !== null && !models.includes(current);
        const selectId = `${provider}-${task}`;
        return (
          <div key={task} className="flex flex-col gap-2">
            <label htmlFor={selectId} className="text-[14px] font-medium">
              {TASK_INFO[task].name}
            </label>
            <select
              id={selectId}
              value={current ?? ""}
              onChange={(event) =>
                void setModel({
                  workspaceId: workspace._id,
                  provider,
                  task,
                  modelId: event.target.value,
                })
              }
              className={`${inputClass} font-mono text-[13px]`}
            >
              {(current === null || missing) && (
                <option value={current ?? ""} disabled>
                  {current ?? "Choose a model"}
                </option>
              )}
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <p className={`text-[12px] ${missing ? "text-danger" : "text-muted"}`}>
              {missing
                ? "Your key cannot use this model. Choose another."
                : TASK_INFO[task].help}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ProviderCard({
  workspace,
  provider,
  keyRow,
  rows,
}: {
  workspace: Current["workspace"];
  provider: Provider;
  keyRow: KeyRow | undefined;
  rows: ModelRow[];
}) {
  const test = useAction(api.secrets.testProviderKey);
  const remove = useMutation(api.secrets.removeProviderKey);
  const setDefault = useMutation(api.secrets.setDefaultProvider);
  const [mode, setMode] = useState<"idle" | "replace" | "remove">("idle");
  const [testing, setTesting] = useState(false);
  const info = PROVIDER_INFO[provider];
  const isDefault = workspace.defaultProvider === provider;
  const args = { workspaceId: workspace._id, provider };

  async function runTest() {
    setTesting(true);
    try {
      await test(args);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[18px] font-medium tracking-[-0.01em]">{info.name}</h2>
        {isDefault && <Badge tone="accent">In use</Badge>}
        {keyRow?.testOk === false && <Badge tone="danger">Key failed</Badge>}
        {keyRow && (
          <span className="ml-auto font-mono text-[12px] text-muted">Key ends in {keyRow.last4}</span>
        )}
      </div>

      {!keyRow && <KeyForm workspaceId={workspace._id} provider={provider} />}

      {keyRow && (
        <>
          {keyRow.testOk === false && (
            <Notice tone="error">{keyRow.testMessage ?? "The last key test failed."}</Notice>
          )}
          <div className="flex flex-wrap gap-2">
            {!isDefault && (
              <Button onClick={() => void setDefault(args)}>
                Use {info.name}
              </Button>
            )}
            <Button variant="secondary" disabled={testing} onClick={runTest}>
              {testing ? "Testing key" : "Test key"}
            </Button>
            <Button variant="ghost" onClick={() => setMode(mode === "replace" ? "idle" : "replace")}>
              Replace key
            </Button>
            {mode === "remove" ? (
              <>
                <Button variant="danger" onClick={() => void remove(args).then(() => setMode("idle"))}>
                  Confirm: remove key
                </Button>
                <Button variant="ghost" onClick={() => setMode("idle")}>
                  Keep key
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setMode("remove")}>
                Remove key
              </Button>
            )}
          </div>
          {mode === "replace" && (
            <KeyForm
              workspaceId={workspace._id}
              provider={provider}
              submitLabel="Replace key"
              onSaved={() => setMode("idle")}
            />
          )}
          <TaskModels key={keyRow.last4} workspace={workspace} provider={provider} rows={rows} />
        </>
      )}
    </Card>
  );
}

function IncludedModels() {
  const { workspace, member, plan, features } = useWorkspace();
  const setUseOwnKey = useMutation(api.billing.setUseOwnKey);
  if (plan === "free" || !features.hostedModels) return null;
  const usingIncluded = workspace.hostedModels;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-medium">Included models</h2>
            {usingIncluded && <Badge tone="lime">In use</Badge>}
          </div>
          <p className="text-[13px] text-muted">
            Your plan includes Claude models. We switch to newer models as they come out. You do not need a key.
          </p>
        </div>
        {isManager(member.role) && (
          <Button
            variant="secondary"
            onClick={() => void setUseOwnKey({ workspaceId: workspace._id, useOwnKey: usingIncluded })}
          >
            {usingIncluded ? "Use my own key instead" : "Use included models"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function ModelSettings() {
  const { workspace, member } = useWorkspace();
  const keys = useQuery(api.secrets.listProviderKeys, { workspaceId: workspace._id });
  const models = useQuery(api.modelConfig.forWorkspace, { workspaceId: workspace._id });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] text-muted">
        Every run uses one provider. Add a key for each provider you want, then choose which one opentopost uses.
      </p>

      <IncludedModels />

      {!isManager(member.role) ? (
        <p className="text-muted">Only the workspace owner can change model settings.</p>
      ) : !keys || !models ? (
        <SkeletonList label="Loading settings" />
      ) : (
        PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider}
            workspace={workspace}
            provider={provider}
            keyRow={keys.find((row) => row.provider === provider)}
            rows={models.filter((row) => row.provider === provider)}
          />
        ))
      )}
    </div>
  );
}
