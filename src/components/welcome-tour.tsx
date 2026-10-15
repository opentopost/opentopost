"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ApproveArt, DraftArt, MomentsArt, RecapArt } from "@/components/tour-art";
import { Button } from "@/components/ui";

const SEEN = "otp_tour_seen";

const SLIDES = [
  {
    Art: MomentsArt,
    title: "It finds what your team shipped",
    body: "opentopost reads GitHub, Slack and your notes, and picks the moments worth a post. Each one shows the facts it found.",
  },
  {
    Art: DraftArt,
    title: "It writes the post in your voice",
    body: "Pick a moment and you get a LinkedIn draft that sounds like you. Every claim links to a fact, so nothing is made up.",
  },
  {
    Art: ApproveArt,
    title: "You approve it, then it posts",
    body: "Drafts come to you in Slack. Approve, edit or pass. A reviewer can sign off, then it posts to LinkedIn on the day you pick.",
  },
  {
    Art: RecapArt,
    title: "Every week, see what you told",
    body: "The recap shows what your team shipped and what it told people, so good work does not stay hidden.",
  },
];

function read() {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, "1");
  } catch {
    // Without storage the tour shows again next visit.
  }
}

/** A four-step tour shown on the first visit. `open` lets the dashboard reopen it. */
export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!open) return null;
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;
  function close() {
    markSeen();
    setIndex(0);
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label="Welcome tour">
      <div className="relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-xl">
        <button
          type="button"
          onClick={close}
          aria-label="Close the tour"
          className="absolute top-3 right-3 z-10 rounded-control bg-surface/90 p-1.5 text-muted hover:text-ink"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
        <div className="aspect-[16/9] w-full overflow-hidden border-b border-line bg-canvas" aria-hidden="true">
          <slide.Art />
        </div>
        <div className="flex flex-col gap-2 p-5">
          <p className="font-mono text-[12px] text-muted">
            {index + 1} of {SLIDES.length}
          </p>
          <h2 className="text-[18px] font-medium tracking-[-0.01em]">{slide.title}</h2>
          <p className="text-[14px] text-muted">{slide.body}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden="true">
              {SLIDES.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full ${i === index ? "w-5 bg-accent" : "w-1.5 bg-fill"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {index > 0 && (
                <Button variant="ghost" onClick={() => setIndex(index - 1)}>
                  Back
                </Button>
              )}
              <Button onClick={() => (last ? close() : setIndex(index + 1))}>{last ? "Start setup" : "Next"}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function tourSeen() {
  return read();
}
