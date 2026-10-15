"use client";

import { isManager } from "@/lib/roles";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { SettingsSection } from "@/components/settings";
import { Badge, Button, Card, inputClass, Notice, textareaClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage } from "@/lib/format";
import { TeamOnly } from "@/components/upgrade";
import { SkeletonList } from "@/components/loader";

type Rule = FunctionReturnType<typeof api.rules.list>[number];
type Scope = "ideas" | "draft";

const TEMPLATES: { name: string; description: string; body: string; scopes: Scope[] }[] = [
  {
    name: "Brand voice",
    description: "How the company sounds in every post.",
    body: "- Plain words. No hype, no buzzwords.\n- Speak as a builder, not a marketer.\n- Name the company as \"we\" only when the author speaks for the team.",
    scopes: ["draft"],
  },
  {
    name: "Claims we cannot make",
    description: "Statements legal or leadership have ruled out.",
    body: "- Do not name customers unless they are on our public customer page.\n- Do not promise dates for features that have not shipped.\n- Do not compare us by name with competitors.",
    scopes: ["draft"],
  },
  {
    name: "Confidential topics",
    description: "Subjects that must never become a moment or a post.",
    body: "- Fundraising and revenue numbers.\n- Hiring plans before they are announced.\n- Security incidents.\n- Anything a customer shared under NDA.",
    scopes: ["ideas", "draft"],
  },
];

const SCOPE_LABELS: Record<Scope, string> = { ideas: "Finding moments", draft: "Writing drafts" };

function RuleEditor({
  workspaceId,
  rule,
  initial,
  onDone,
}: {
  workspaceId: Id<"workspaces">;
  rule?: Rule;
  initial?: (typeof TEMPLATES)[number];
  onDone: () => void;
}) {
  const save = useMutation(api.rules.save);
  const [name, setName] = useState(rule?.name ?? initial?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? initial?.description ?? "");
  const [body, setBody] = useState(rule?.body ?? initial?.body ?? "");
  const [scopes, setScopes] = useState<Scope[]>(rule?.scopes ?? initial?.scopes ?? ["draft"]);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await save({ workspaceId, ruleId: rule?._id, name, description, body, scopes, enabled: rule?.enabled ?? true });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-item border border-accent bg-surface p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" aria-label="Rule name" className={inputClass} />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="One line about what this rule is for"
        aria-label="Description"
        className={inputClass}
      />
      <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Rule" className={textareaClass} />
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-[12px] text-muted">Applies when</legend>
        {(Object.keys(SCOPE_LABELS) as Scope[]).map((scope) => (
          <label key={scope} className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={scopes.includes(scope)}
              onChange={(e) => setScopes(e.target.checked ? [...scopes, scope] : scopes.filter((s) => s !== scope))}
              className="accent-[var(--color-accent)]"
            />
            {SCOPE_LABELS[scope]}
          </label>
        ))}
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void submit()}>Save rule</Button>
      </div>
    </div>
  );
}

export default function RulesSettings() {
  const { workspace, member, features } = useWorkspace();
  const rules = useQuery(api.rules.list, { workspaceId: workspace._id });
  const setEnabled = useMutation(api.rules.setEnabled);
  const remove = useMutation(api.rules.remove);
  const [editing, setEditing] = useState<string | null>(null);
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number] | null>(null);
  const owner = isManager(member.role);
  const existing = new Set(rules?.map((rule) => rule.name));

  if (!features.rules) {
    return (
      <TeamOnly
        feature="rules"
        detail="Write your brand voice, claims you cannot make, and topics to avoid once. Every scan and draft follows them."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        title="Company rules"
        description="Rules every scan and every draft in this workspace follows. The claims check flags any sentence that breaks one."
      >
        {rules === undefined ? (
          <SkeletonList label="Loading rules" rows={2} compact />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.length === 0 && !template && editing !== "new" && (
              <p className="text-[13px] text-muted">No rules yet. Start from a template below.</p>
            )}
            {rules.map((rule) =>
              editing === rule._id ? (
                <RuleEditor key={rule._id} workspaceId={workspace._id} rule={rule} onDone={() => setEditing(null)} />
              ) : (
                <Card key={rule._id} as="div" className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-medium">{rule.name}</p>
                    {rule.scopes.map((scope) => (
                      <Badge key={scope} tone="fill">
                        {SCOPE_LABELS[scope]}
                      </Badge>
                    ))}
                    {!rule.enabled && <Badge tone="danger">Off</Badge>}
                  </div>
                  {rule.description && <p className="text-[12px] text-muted">{rule.description}</p>}
                  <pre className="font-sans text-[13px] whitespace-pre-wrap text-body">{rule.body}</pre>
                  {owner && (
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setEditing(rule._id)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => void setEnabled({ ruleId: rule._id, enabled: !rule.enabled })}>
                        {rule.enabled ? "Turn off" : "Turn on"}
                      </Button>
                      <Button variant="danger" className="ml-auto" onClick={() => void remove({ ruleId: rule._id })}>
                        <Trash2 size={14} strokeWidth={1.75} />
                      </Button>
                    </div>
                  )}
                </Card>
              ),
            )}
            {(template || editing === "new") && (
              <RuleEditor
                key={template?.name ?? "new"}
                workspaceId={workspace._id}
                initial={template ?? undefined}
                onDone={() => {
                  setTemplate(null);
                  setEditing(null);
                }}
              />
            )}
          </div>
        )}
        {owner ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {TEMPLATES.filter((t) => !existing.has(t.name)).map((t) => (
              <Button key={t.name} variant="secondary" onClick={() => setTemplate(t)}>
                <Plus size={14} strokeWidth={1.75} />
                {t.name}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setEditing("new")}>
              <Plus size={14} strokeWidth={1.75} />
              Blank rule
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-muted">Only owners can change rules.</p>
        )}
      </SettingsSection>
    </div>
  );
}
