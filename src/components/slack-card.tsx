"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Hash, MessageSquare } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SlackLogo } from "./brand-icons";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Card, inputClass, Notice, Spinner } from "./ui";
import { errorMessage, timeAgo } from "@/lib/format";
import { TeamOnly } from "./upgrade";
import { useWorkspace } from "./workspace";
import { SkeletonList } from "./loader";

type Channel = { id: string; name: string };

const RESULTS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Slack is connected. Choose the channels to read." },
  error: { ok: false, text: "Slack did not finish connecting. Try again." },
  expired: { ok: false, text: "The Slack sign-in took too long. Try again." },
  cancelled: { ok: false, text: "Slack sign-in was cancelled." },
};

function ChannelPicker({
  workspaceId,
  initial,
  initialIdeas,
  onDone,
}: {
  workspaceId: Id<"workspaces">;
  initial: Channel[];
  initialIdeas: Channel | null;
  onDone: () => void;
}) {
  const listChannels = useAction(api.slack.listChannels);
  const saveChannels = useAction(api.slack.saveChannels);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [selected, setSelected] = useState(new Set(initial.map((c) => c.id)));
  const [ideas, setIdeas] = useState(initialIdeas?.id ?? "");
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listChannels({ workspaceId })
      .then((list) => !cancelled && setChannels(list))
      .catch((err) => !cancelled && setError(errorMessage(err, "The channel list did not load.")));
    return () => {
      cancelled = true;
    };
  }, [listChannels, workspaceId]);

  async function save() {
    if (!channels) return;
    setPending(true);
    setError(null);
    try {
      const chosen = channels.filter((c) => selected.has(c.id));
      await saveChannels({ workspaceId, channels: chosen, ideasChannel: channels.find((c) => c.id === ideas) });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!channels) return <SkeletonList label="Loading channels" rows={2} compact />;
  const visible = channels.filter((c) => c.name.includes(filter.toLowerCase()));

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="text-[13px] font-medium">Channels to read ({selected.size} of 20)</p>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter channels" aria-label="Filter channels" className={inputClass} />
      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-item border border-line bg-surface p-2 sm:grid-cols-2">
        {visible.map((channel) => (
          <label key={channel.id} className="flex items-center gap-2 rounded-control px-2 py-1 text-[13px] hover:bg-fill">
            <input
              type="checkbox"
              checked={selected.has(channel.id)}
              disabled={!selected.has(channel.id) && selected.size >= 20}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(channel.id);
                else next.delete(channel.id);
                setSelected(next);
              }}
              className="accent-[var(--color-accent)]"
            />
            <Hash size={12} strokeWidth={1.75} className="text-muted" />
            <span className="truncate">{channel.name}</span>
          </label>
        ))}
      </div>
      <label htmlFor="ideas-channel" className="text-[13px] font-medium">
        Post ideas and the weekly recap to
      </label>
      <select id="ideas-channel" value={ideas} onChange={(e) => setIdeas(e.target.value)} className={inputClass}>
        <option value="">Do not post to Slack</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
      <p className="text-[12px] text-muted">opentopost joins the channels you choose. It reads only those channels.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={pending}>
          {pending && <Spinner />}
          Save channels
        </Button>
      </div>
    </div>
  );
}

export function SlackCard({ workspaceId, owner }: { workspaceId: Id<"workspaces">; owner: boolean }) {
  const { features } = useWorkspace();
  const status = useQuery(api.slack.status, { workspaceId });
  const startOAuth = useAction(api.slack.startOAuth);
  const disconnect = useMutation(api.slack.disconnect);
  const params = useSearchParams();
  const result = RESULTS[params.get("slack") ?? ""];
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [starting, setStarting] = useState(false);

  async function connect() {
    setError(null);
    setStarting(true);
    try {
      window.location.assign(await startOAuth({ workspaceId }));
    } catch (err) {
      setError(errorMessage(err));
      setStarting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MessageSquare size={16} strokeWidth={1.75} />
        <h2 className="text-[16px] font-medium">Slack</h2>
        {status?.connected && <Badge>Connected to {status.teamName}</Badge>}
      </div>
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {status === undefined ? (
        <SkeletonList label="Loading" rows={2} compact />
      ) : !status.available ? (
        <p className="text-[13px] text-muted">
          Slack is not set up on this deployment. The integrations guide in the repository explains how to create the Slack app and set its keys.
        </p>
      ) : !status.connected && !features.slack ? (
        <TeamOnly feature="slack" detail="Find moments in the channels you choose, and claim ideas without leaving Slack." />
      ) : !status.connected ? (
        <>
          <p className="text-[13px] text-muted">
            Read the channels you choose, find moments in them, and post ideas with a Claim button to a channel of your choice.
          </p>
          {owner ? (
            <Button className="self-start" onClick={() => void connect()} disabled={starting}>
              {starting ? <Spinner /> : <SlackLogo size={14} />}
              Connect Slack
            </Button>
          ) : (
            <p className="text-[13px] text-muted">An owner can connect Slack.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {status.channels.length === 0 ? (
              <p className="text-[13px] text-muted">No channels chosen yet.</p>
            ) : (
              status.channels.map((channel) => (
                <Badge key={channel.id} tone="fill">
                  #{channel.name}
                </Badge>
              ))
            )}
          </div>
          <p className="text-[12px] text-muted">
            {status.ideasChannel ? `Ideas and recaps go to #${status.ideasChannel.name}. ` : "Ideas are not posted to Slack. "}
            {status.lastScannedAt ? `Last read ${timeAgo(status.lastScannedAt)}.` : "Read on the next scan."}
          </p>
          {owner && !picking && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPicking(true)}>
                Choose channels
              </Button>
              {confirm ? (
                <>
                  <Button variant="danger" onClick={() => void disconnect({ workspaceId })}>
                    Confirm: disconnect
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Disconnect
                </Button>
              )}
            </div>
          )}
          {picking && (
            <ChannelPicker
              workspaceId={workspaceId}
              initial={status.channels}
              initialIdeas={status.ideasChannel}
              onDone={() => setPicking(false)}
            />
          )}
        </>
      )}
    </Card>
  );
}
