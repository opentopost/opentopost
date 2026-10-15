"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AudioLines,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge, Button, Card, fieldClass, inputClass, Notice, Spinner, textareaClass } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { errorMessage, timeAgo } from "@/lib/format";
import { SkeletonList } from "@/components/loader";

type Voice = FunctionReturnType<typeof api.voice.mine>;
type Sample = Voice["samples"][number];
type Kind = Sample["kind"];
type Scope = { workspaceId: Id<"workspaces">; company?: boolean };

const KINDS: { value: Kind; label: string }[] = [
  { value: "post", label: "LinkedIn post" },
  { value: "tweet", label: "X post" },
  { value: "article", label: "Article or blog" },
  { value: "note", label: "Note or message" },
  { value: "spoken", label: "Spoken words" },
  { value: "other", label: "Other writing" },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((kind) => [kind.value, kind.label])) as Record<Kind, string>;

const ORIGIN_ICON: Record<Sample["origin"], LucideIcon> = {
  paste: FileText,
  recording: Mic,
  audio: AudioLines,
  video: Video,
  image: ImageIcon,
  link: Link2,
};

const MAX_RECORDING_SECONDS = 300;

type Tab = "paste" | "record" | "upload" | "link";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "paste", label: "Paste", icon: FileText },
  { id: "record", label: "Record", icon: Mic },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "link", label: "Link", icon: Link2 },
];

function KindSelect({ value, onChange, id }: { value: Kind; onChange: (kind: Kind) => void; id: string }) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as Kind)} className={fieldClass}>
      {KINDS.filter((kind) => kind.value !== "spoken").map((kind) => (
        <option key={kind.value} value={kind.value}>
          {kind.label}
        </option>
      ))}
    </select>
  );
}

function useUpload(scope: Scope) {
  const uploadUrl = useMutation(api.voice.uploadUrl);
  const addMedia = useMutation(api.voice.addMedia);
  return async (file: Blob, origin: "recording" | "audio" | "video" | "image", fileName?: string) => {
    const url = await uploadUrl(scope);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("upload failed");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    await addMedia({ ...scope, storageId, origin, fileName });
  };
}

function PasteForm({ scope, onDone }: { scope: Scope; onDone: (message: string) => void }) {
  const addText = useMutation(api.voice.addText);
  const [kind, setKind] = useState<Kind>("post");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addText({ ...scope, kind, text });
      setText("");
      onDone("Sample added.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="paste-kind" className="text-[13px] text-muted">
          This is a
        </label>
        <KindSelect id="paste-kind" value={kind} onChange={setKind} />
      </div>
      <label htmlFor="paste-text" className="sr-only">
        Text
      </label>
      <textarea
        id="paste-text"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste a post, a tweet, a paragraph from your blog, or a message you sent."
        className={textareaClass}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" className="self-end" disabled={text.trim().length < 40}>
        Add sample
      </Button>
    </form>
  );
}

function RecordForm({
  scope,
  canHear,
  onDone,
}: {
  scope: Scope;
  canHear: boolean;
  onDone: (message: string) => void;
}) {
  const upload = useUpload(scope);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_RECORDING_SECONDS) recorder.current?.stop();
  }, [recording, seconds]);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
      const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunks.current, { type: (media.mimeType || "audio/webm").split(";")[0] });
        if (blob.size === 0) return;
        setPending(true);
        try {
          await upload(blob, "recording", `Voice note ${new Date().toLocaleDateString()}`);
          onDone("Recording saved. We are transcribing it now.");
        } catch (err) {
          setError(errorMessage(err, "The recording did not upload. Try again."));
        } finally {
          setPending(false);
        }
      };
      recorder.current = media;
      setSeconds(0);
      media.start(1000);
      setRecording(true);
    } catch {
      setError("We could not use your microphone. Allow microphone access in your browser, then try again.");
    }
  }

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Talk about your work the way you would to a friend: what you shipped, what went wrong, what you learned. We
        write down your exact words and learn how you speak. Up to five minutes.
      </p>
      {!canHear && (
        <Notice tone="error">
          Recordings need Gemini. Add a Gemini key in Settings &gt; Model, or move to a paid plan.
        </Notice>
      )}
      <div className="flex items-center gap-3">
        {recording ? (
          <Button variant="dark" size="md" onClick={() => recorder.current?.stop()}>
            <Square size={14} strokeWidth={2} fill="currentColor" />
            Stop and save
          </Button>
        ) : (
          <Button size="md" onClick={() => void start()} disabled={pending || !canHear}>
            {pending ? <Spinner /> : <Mic size={14} strokeWidth={1.75} />}
            {pending ? "Saving" : "Start recording"}
          </Button>
        )}
        {recording && (
          <span className="flex items-center gap-2 font-mono text-[13px] text-ink" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {time} / 5:00
          </span>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function UploadForm({
  scope,
  canHear,
  maxMb,
  onDone,
}: {
  scope: Scope;
  canHear: boolean;
  maxMb: number;
  onDone: (message: string) => void;
}) {
  const upload = useUpload(scope);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPending(true);
    let added = 0;
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const family = file.type.split("/")[0];
        if (family !== "audio" && family !== "video" && family !== "image") {
          setError(`${file.name} is not audio, video, or an image.`);
          continue;
        }
        if (family !== "image" && !canHear) {
          setError("Audio and video need Gemini. Add a Gemini key in Settings > Model, or move to a paid plan.");
          continue;
        }
        if (file.size > maxMb * 1024 * 1024) {
          setError(`${file.name} is over ${maxMb} MB. For a long video, upload the audio only.`);
          continue;
        }
        await upload(file, family, file.name);
        added += 1;
      }
      if (added) onDone(`${added} file${added === 1 ? "" : "s"} added. We are reading ${added === 1 ? "it" : "them"} now.`);
    } catch (err) {
      setError(errorMessage(err, "The upload failed. Try again."));
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Screenshots of your tweets or posts, photos of notes you wrote, voice memos, or clips of you talking at an event
        or on a podcast. Up to {maxMb} MB each.
      </p>
      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-item border border-dashed border-line bg-surface px-4 py-8 text-center hover:bg-fill"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void onFiles(event.dataTransfer.files);
        }}
      >
        {pending ? <Spinner /> : <Upload size={20} strokeWidth={1.75} className="text-muted" />}
        <span className="text-[14px] font-medium text-ink">{pending ? "Uploading" : "Choose files or drop them here"}</span>
        <span className="text-[12px] text-muted">Images, audio, or video</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={canHear ? "image/*,audio/*,video/*" : "image/*"}
          className="sr-only"
          disabled={pending}
          onChange={(event) => void onFiles(event.target.files)}
        />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function LinkForm({ scope, onDone }: { scope: Scope; onDone: (message: string) => void }) {
  const addLink = useMutation(api.voice.addLink);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<Kind>("article");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addLink({ ...scope, url, kind });
      setUrl("");
      onDone("Link added. We are reading the page now.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        A blog post, newsletter, or article you wrote. X and LinkedIn do not let other apps read posts, so paste those
        or upload a screenshot.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="link-url" className="sr-only">
          Link
        </label>
        <input
          id="link-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://yourblog.com/post"
          className={inputClass}
        />
        <KindSelect id="link-kind" value={kind} onChange={setKind} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" variant="secondary" className="self-end" disabled={!url.trim()}>
        Add link
      </Button>
    </form>
  );
}

function AddSample({ voice, scope }: { voice: Voice; scope: Scope }) {
  const { workspace } = useWorkspace();
  const [tab, setTab] = useState<Tab>("paste");
  const [message, setMessage] = useState<string | null>(null);
  const canHear = workspace.hostedMedia || workspace.defaultProvider === "google";
  const full = voice.samples.length >= voice.maxSamples;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-medium">{voice.company ? "Add to the company voice" : "Add to your voice"}</h2>
          <p className="text-[13px] text-muted">
            {voice.company
              ? "Add posts from your company page, blog posts, launch notes, and talks by your founders."
              : "The more places you add from, the more drafts sound like you."}
          </p>
        </div>
        <span className="font-mono text-[12px] text-muted">
          {voice.samples.length} / {voice.maxSamples}
        </span>
      </div>
      {full ? (
        <p className="text-[13px] text-muted">You have {voice.maxSamples} samples. Remove one to add another.</p>
      ) : (
        <>
          <div role="tablist" aria-label="How to add" className="flex gap-1 rounded-control bg-fill p-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(item.id);
                    setMessage(null);
                  }}
                  className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[5px] text-[14px] font-medium transition-colors ${
                    active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {item.label}
                </button>
              );
            })}
          </div>
          {message && <Notice tone="ok">{message}</Notice>}
          {tab === "paste" && <PasteForm scope={scope} onDone={setMessage} />}
          {tab === "record" && <RecordForm scope={scope} canHear={canHear} onDone={setMessage} />}
          {tab === "upload" && (
            <UploadForm scope={scope} canHear={canHear} maxMb={voice.maxFileMb} onDone={setMessage} />
          )}
          {tab === "link" && <LinkForm scope={scope} onDone={setMessage} />}
        </>
      )}
    </Card>
  );
}

function SampleRow({ sample, scope }: { sample: Sample; scope: Scope }) {
  const removeSample = useMutation(api.voice.removeSample);
  const updateSample = useMutation(api.voice.updateSample);
  const retry = useMutation(api.voice.retry);
  const [open, setOpen] = useState(false);
  const Icon = ORIGIN_ICON[sample.origin];
  const sampleId = sample._id as Id<"voiceSamples">;

  return (
    <li className="flex gap-3 rounded-item border border-line bg-surface p-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-accent-soft text-ink">
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {sample.legacy || sample.status !== "ready" ? (
            <Badge tone="fill">{KIND_LABEL[sample.kind]}</Badge>
          ) : (
            <select
              aria-label="Kind of sample"
              value={sample.kind}
              onChange={(event) => void updateSample({ sampleId, kind: event.target.value as Kind })}
              className="h-6 rounded-[4px] border border-line bg-white px-1.5 text-[12px] font-medium"
            >
              {KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          )}
          {sample.title && <span className="truncate text-[13px] font-medium text-ink">{sample.title}</span>}
          <span className="text-[12px] text-muted">{timeAgo(sample.createdAt)}</span>
        </div>
        {sample.status === "processing" && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Spinner />
            {sample.origin === "link" ? "Reading the page" : sample.origin === "image" ? "Reading the image" : "Transcribing"}
          </p>
        )}
        {sample.status === "failed" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] text-danger">{sample.error ?? "This sample failed."}</p>
            <Button variant="ghost" onClick={() => void retry({ sampleId })}>
              <RotateCcw size={13} strokeWidth={1.75} />
              Try again
            </Button>
          </div>
        )}
        {sample.status === "ready" && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={`text-left text-[13px] whitespace-pre-wrap text-body ${open ? "" : "line-clamp-3"}`}
          >
            {sample.text}
            {open && sample.length > sample.text.length ? " …" : ""}
          </button>
        )}
        {(sample.sourceUrl || sample.fileName) && (
          <p className="truncate text-[12px] text-muted">
            {sample.sourceUrl ? (
              <a href={sample.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                {sample.sourceUrl}
              </a>
            ) : (
              sample.fileName
            )}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        aria-label="Remove sample"
        className="w-8 px-0"
        onClick={() => void removeSample({ ...scope, sampleId: sample._id })}
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </Button>
    </li>
  );
}

function Samples({ voice, scope }: { voice: Voice; scope: Scope }) {
  const [filter, setFilter] = useState<"all" | "written" | "spoken">("all");
  const shown = voice.samples.filter((sample) =>
    filter === "all" ? true : filter === "spoken" ? sample.kind === "spoken" : sample.kind !== "spoken",
  );
  if (voice.samples.length === 0) return null;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-medium">Your samples</h2>
        <div className="flex gap-1">
          {(["all", "written", "spoken"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`h-7 rounded-[5px] px-2.5 text-[13px] font-medium capitalize ${
                filter === value ? "bg-ink text-white" : "text-muted hover:bg-fill hover:text-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((sample) => (
          <SampleRow key={sample._id} sample={sample} scope={scope} />
        ))}
      </ul>
    </Card>
  );
}

const TRIGGER_LABEL = { manual: "Analyzed", auto: "Updated on its own", edit: "Edited by you", restore: "Restored" };

function Profile({ voice, scope }: { voice: Voice; scope: Scope }) {
  const analyze = useAction(api.voice.analyze);
  const setStyleNotes = useMutation(api.voice.setStyleNotes);
  const setAutoUpdate = useMutation(api.voice.setAutoUpdate);
  const restore = useMutation(api.voice.restoreVersion);
  const [notes, setNotes] = useState(voice.styleNotes);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState(false);
  const ready = voice.readyCount >= voice.minSamples;
  const busy = pending || voice.analyzing;

  async function runAnalysis() {
    setPending(true);
    setResult(null);
    try {
      setResult(await analyze(scope));
    } catch {
      setResult({ ok: false, message: "The analysis failed. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-medium">{voice.company ? "Company voice profile" : "Voice profile"}</h2>
          <p className="text-[13px] text-muted">
            {voice.analyzedAt ? `Updated ${timeAgo(voice.analyzedAt)}. ` : ""}
            Every draft follows these rules. Edit them freely.
          </p>
        </div>
        <Button onClick={() => void runAnalysis()} disabled={!ready || busy}>
          {busy ? <Spinner /> : <Sparkles size={14} strokeWidth={1.75} />}
          {busy ? "Analyzing" : voice.analyzedAt ? "Analyze again" : "Analyze my voice"}
        </Button>
      </div>
      {!ready && (
        <p className="text-[13px] text-muted">Add at least {voice.minSamples} samples to build your voice profile.</p>
      )}
      {result && <Notice tone={result.ok ? "ok" : "error"}>{result.message}</Notice>}
      {!result && voice.lastError && <Notice tone="error">{voice.lastError}</Notice>}
      <label className="flex items-start gap-3 rounded-item bg-fill p-3">
        <input
          type="checkbox"
          checked={voice.autoUpdate}
          onChange={(event) => void setAutoUpdate({ ...scope, autoUpdate: event.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        <span className="text-[13px]">
          <span className="font-medium text-ink">Keep my voice up to date</span>
          <span className="block text-muted">
            Update the profile a minute after you add or change a sample.{voice.company ? "" : " Your edits to drafts count too."}
          </span>
        </span>
      </label>
      <label htmlFor="notes" className="sr-only">
        Voice notes
      </label>
      <textarea
        id="notes"
        rows={10}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="- Opens with a short, plain statement.&#10;- Uses short paragraphs of one or two lines."
        className={textareaClass}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {voice.versions.length > 0 ? (
          <Button variant="ghost" onClick={() => setHistory((value) => !value)}>
            {history ? "Hide history" : `History (${voice.versions.length})`}
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="secondary"
          disabled={notes === voice.styleNotes}
          onClick={() => void setStyleNotes({ ...scope, styleNotes: notes })}
        >
          Save notes
        </Button>
      </div>
      {history && (
        <ol className="flex flex-col gap-2">
          {voice.versions.map((version, index) => (
            <li key={version._id} className="flex flex-col gap-2 rounded-item border border-line bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-muted">
                  {TRIGGER_LABEL[version.trigger]} {timeAgo(version.createdAt)} · {version.sampleCount} samples
                </span>
                {index === 0 ? (
                  <Badge tone="lime">Current</Badge>
                ) : (
                  <Button variant="ghost" onClick={() => void restore({ versionId: version._id })}>
                    <RotateCcw size={13} strokeWidth={1.75} />
                    Restore
                  </Button>
                )}
              </div>
              <p className="line-clamp-4 text-[13px] whitespace-pre-wrap text-body">{version.styleNotes}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function BannedWords({ voice, scope }: { voice: Voice; scope: Scope }) {
  const setBannedWords = useMutation(api.voice.setBannedWords);
  const [value, setValue] = useState(voice.bannedWords.join(", "));
  const words = value.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean);
  const changed = words.join(",") !== voice.bannedWords.join(",");

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-[16px] font-medium">Words to avoid</h2>
      <p className="text-[13px] text-muted">Drafts never use these. Separate them with commas.</p>
      <label htmlFor="banned" className="sr-only">
        Words to avoid
      </label>
      <input
        id="banned"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="delve, game-changer, thrilled, excited to announce"
        className={inputClass}
      />
      <Button
        variant="secondary"
        className="self-end"
        disabled={!changed}
        onClick={() => void setBannedWords({ ...scope, words })}
      >
        Save words
      </Button>
    </Card>
  );
}

export function VoiceStudio({ company = false }: { company?: boolean }) {
  const { workspace } = useWorkspace();
  const scope: Scope = { workspaceId: workspace._id, company };
  const voice = useQuery(api.voice.mine, scope);
  if (voice === undefined) return <SkeletonList label="Loading the voice" />;
  return (
    <>
      {voice.canEdit ? (
        <AddSample voice={voice} scope={scope} />
      ) : (
        <Notice tone="ok">Only a workspace owner can change the company voice. You can read it here.</Notice>
      )}
      <Samples voice={voice} scope={scope} />
      <Profile key={voice.analyzedAt ?? 0} voice={voice} scope={scope} />
      <BannedWords key={voice.bannedWords.join(",")} voice={voice} scope={scope} />
    </>
  );
}
