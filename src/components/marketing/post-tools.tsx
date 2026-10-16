"use client";

import { Check, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { aiTells } from "../../../convex/lib/style";
import { inputClass, textareaClass } from "@/components/ui";

/** Where LinkedIn folds a post behind "see more". These are close, not exact: the feed also cuts by lines. */
const CUT = { mobile: 140, desktop: 210 } as const;
type Device = keyof typeof CUT;

const SAMPLE =
  "Northwind stopped polling our API last month, and their ops team noticed before we told them.\n\nDeliveries now land in under 2 seconds instead of 30, and the only thing they changed was moving to webhooks.\n\nWhat do you still poll that you could have pushed?";

function fold(text: string, device: Device) {
  const limit = CUT[device];
  const lines = text.split("\n");
  let shown = "";
  let used = 0;
  for (let index = 0; index < lines.length && index < 3; index += 1) {
    const room = limit - used;
    if (room <= 0) break;
    const line = lines[index];
    if (line.length > room) {
      shown += line.slice(0, room).replace(/\s+\S*$/, "");
      return { shown: shown.trimEnd(), folded: true };
    }
    shown += (index ? "\n" : "") + line;
    used += line.length + 1;
  }
  const folded = shown.length < text.trim().length;
  return { shown: shown.trimEnd(), folded };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
      {label}
      {children}
    </label>
  );
}

type Row = { ok: boolean; title: string; note: string };

function rowsFor(text: string): Row[] {
  const body = text.trim();
  if (!body) return [];
  const rows: Row[] = [];
  const first = body.split("\n")[0].trim();
  const mobile = fold(body, "mobile");

  rows.push({
    ok: first.length <= 120,
    title: `First line: ${first.length} characters`,
    note:
      first.length <= 120
        ? "Short enough to read in full before the fold."
        : "Long. Readers decide from this line, so cut it to one clear sentence of about 120 characters or fewer.",
  });

  const cutMidSentence = mobile.folded && !/[.!?:]$/.test(mobile.shown);
  rows.push({
    ok: !mobile.folded || !cutMidSentence,
    title: mobile.folded ? "The fold on mobile" : "No fold on mobile",
    note: !mobile.folded
      ? "The whole post shows without a tap."
      : cutMidSentence
        ? "The fold lands in the middle of a sentence. Finish your hook before about 140 characters so people want the rest."
        : "The fold lands at the end of a sentence, which is where you want it.",
  });

  const chars = body.length;
  const words = body.split(/\s+/).length;
  rows.push({
    ok: chars >= 600 && chars <= 2200,
    title: `${chars.toLocaleString()} characters, ${words} words, about ${Math.max(1, Math.round(words / 220))} min read`,
    note:
      chars < 600
        ? "Short. Fine for a quick thought, but a post that tells one small story usually needs 600 to 2,000 characters."
        : chars > 2200
          ? "Long. Cut what does not serve your one point. LinkedIn stops at 3,000 characters."
          : "A good length for one point told with one example.",
  });

  const paragraphs = body.split(/\n\s*\n/);
  const longest = Math.max(...paragraphs.map((p) => p.length));
  rows.push({
    ok: longest <= 450,
    title: `Longest paragraph: ${longest} characters`,
    note: longest <= 450 ? "Easy to scan on a phone." : "A wall of text on mobile. Split it where the thought changes.",
  });

  const tags = (body.match(/(^|\s)#\w+/g) ?? []).length;
  rows.push({
    ok: tags <= 3,
    title: tags === 0 ? "No hashtags" : `${tags} hashtag${tags === 1 ? "" : "s"}`,
    note: tags <= 3 ? "Fine." : "Many hashtags look like marketing. Keep two or three, or none.",
  });

  const tells = aiTells(body);
  rows.push({
    ok: tells.length === 0,
    title: tells.length === 0 ? "No AI tells found" : `${tells.length} AI tell${tells.length === 1 ? "" : "s"} found`,
    note: tells.length === 0 ? "Nothing in it reads as machine-written." : `Rewrite: ${tells.join("; ")}.`,
  });
  return rows;
}

export function PostChecker() {
  const [text, setText] = useState("");
  const rows = useMemo(() => rowsFor(text), [text]);
  const good = rows.filter((row) => row.ok).length;

  return (
    <div className="grid gap-6 pb-24 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <Field label="Your draft">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            placeholder="Paste your LinkedIn post here"
            className={`${textareaClass} w-full`}
          />
        </Field>
        <button type="button" onClick={() => setText(SAMPLE)} className="self-start text-[13px] text-muted underline decoration-line underline-offset-4 hover:text-ink">
          Try an example
        </button>
      </div>
      <div className="flex flex-col gap-3" aria-live="polite">
        <p className="text-[13px] font-medium text-ink">Checks</p>
        {rows.length === 0 ? (
          <p className="rounded-card border border-dashed border-line p-6 text-[14px] text-muted">Paste a draft and the checks appear here.</p>
        ) : (
          <>
            <p className="text-[14px] text-body">
              {good} of {rows.length} checks pass.
            </p>
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.title} className="flex gap-3 rounded-card border border-line bg-surface p-4">
                  <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${row.ok ? "bg-lime text-lime-ink" : "bg-danger-soft text-danger"}`}>
                    {row.ok ? <Check size={12} strokeWidth={2.25} /> : <TriangleAlert size={12} strokeWidth={2} />}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[14px] font-medium text-ink">
                      {row.title}
                      <span className="sr-only">{row.ok ? " (passes)" : " (needs work)"}</span>
                    </p>
                    <p className="text-[13px] leading-relaxed text-muted">{row.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function PostPreview() {
  const [text, setText] = useState(SAMPLE);
  const [device, setDevice] = useState<Device>("mobile");
  const [name, setName] = useState("Your name");
  const [headline, setHeadline] = useState("What you do, and who it helps");
  const [photo, setPhoto] = useState<string | null>(null);
  const { shown, folded } = useMemo(() => fold(text.trim(), device), [text, device]);
  const rest = folded ? text.trim().slice(shown.length).trim() : "";

  function pick(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  }

  return (
    <div className="grid gap-8 pb-24 md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-4">
        <Field label="Your post">
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={12} className={`${textareaClass} w-full`} />
        </Field>
        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Headline">
          <input value={headline} onChange={(event) => setHeadline(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Photo (stays on your device)">
          <input type="file" accept="image/*" onChange={(event) => pick(event.target.files?.[0])} className="text-[13px] font-normal text-muted" />
        </Field>
      </div>

      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Device" className="inline-flex self-start rounded-control border border-line bg-surface p-0.5 text-[13px]">
          {(["mobile", "desktop"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={device === option}
              onClick={() => setDevice(option)}
              className={`rounded-[4px] px-3 py-1.5 font-medium capitalize ${device === option ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className={`rounded-card border border-line bg-surface p-4 ${device === "mobile" ? "max-w-[380px]" : "w-full"}`}>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="size-12 rounded-full object-cover" /> : <span className="size-12 rounded-full bg-fill" aria-hidden />}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{name || "Your name"}</p>
              <p className="truncate text-[12px] text-muted">{headline}</p>
              <p className="text-[12px] text-faint">1h · Public</p>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.45] text-ink">
            {shown}
            {folded && (
              <>
                {"… "}
                <span className="font-medium text-muted">see more</span>
              </>
            )}
          </p>
        </div>

        {folded ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] font-medium text-ink">Hidden until someone taps “see more”</p>
            <p className="whitespace-pre-wrap rounded-card border border-dashed border-line p-4 text-[13px] leading-relaxed text-muted">{rest}</p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">The whole post fits before the fold on {device}.</p>
        )}
        <p className="text-[12px] text-faint">The fold is close to where LinkedIn cuts, about {CUT[device]} characters or three lines. LinkedIn can move it a little.</p>
      </div>
    </div>
  );
}
