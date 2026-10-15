"use client";

import { isManager } from "@/lib/roles";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { ConnectorsCard } from "@/components/connectors-card";
import { GitHubCard } from "@/components/github-card";
import { McpCard } from "@/components/mcp-card";
import { SlackCard } from "@/components/slack-card";
import { useState, type FormEvent } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button, Card, EmptyState, inputClass, Notice, PageHeader, Spinner, textareaClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";


export default function SourcesPage() {
  const { workspace, member } = useWorkspace();
  const data = useQuery(api.sources.overview, { workspaceId: workspace._id });
  const addNote = useMutation(api.sources.addNote);
  const removeNote = useMutation(api.sources.removeNote);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await addNote({ workspaceId: workspace._id, title, text, url });
      setTitle("");
      setText("");
      setUrl("");
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6">
      <PageHeader
        title="Sources"
        description="opentopost finds post ideas in the work you add here. Each scan reads the last 14 days."
      />

      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} strokeWidth={1.75} />
            <h2 className="text-[16px] font-medium">Add notes</h2>
          </div>
          <p className="text-[13px] text-muted">
            Paste meeting notes, a changelog, a customer call summary, a Slack thread, or anything your team did this week.
          </p>
          <label htmlFor="note-title" className="sr-only">
            Title
          </label>
          <input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional)"
            className={inputClass}
          />
          <label htmlFor="note-text" className="sr-only">
            Notes
          </label>
          <textarea
            id="note-text"
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What happened, what you decided, what you learned, and any numbers."
            className={textareaClass}
          />
          <label htmlFor="note-url" className="sr-only">
            Link
          </label>
          <input
            id="note-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Link to the source (optional)"
            className={inputClass}
          />
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="ok">Note added. Find ideas when you are ready.</Notice>}
          <div className="flex justify-end">
            <Button type="submit" size="md" disabled={pending || text.trim().length < 30}>
              {pending && <Spinner />}
              Add note
            </Button>
          </div>
        </form>
      </Card>

      <SlackCard workspaceId={workspace._id} owner={isManager(member.role)} />

      <GitHubCard workspaceId={workspace._id} owner={isManager(member.role)} />

      <ConnectorsCard workspaceId={workspace._id} />

      <McpCard workspaceId={workspace._id} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium">Your notes</h2>
          {data?.lastScannedAt && <span className="text-[12px] text-muted">Last scanned {timeAgo(data.lastScannedAt)}</span>}
        </div>
        {data === undefined ? (
          <SkeletonList label="Loading notes" />
        ) : data.notes.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} strokeWidth={1.75} />}
            title="No notes yet"
            body="Add your first note above. Three or four detailed notes give the best ideas."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {data.notes.map((note) => (
                <li key={note._id} className="flex gap-4 border-t border-line px-5 py-4 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{note.title ?? note.text.split("\n")[0]}</p>
                    <p className="line-clamp-2 text-[13px] text-muted">{note.text}</p>
                    <p className="mt-1 flex items-center gap-2 text-[12px] text-faint">
                      {note.author && <span>{note.author}</span>}
                      <span>{timeAgo(note.createdAt)}</span>
                      {note.url && (
                        <a href={note.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                          Link
                          <ExternalLink size={11} strokeWidth={1.75} />
                        </a>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label="Remove note"
                    className="w-8 px-0"
                    onClick={() => void removeNote({ workspaceId: workspace._id, itemId: note._id })}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
