import { Check } from "lucide-react";
import { MarkGlyph } from "./mark";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`otp-skeleton rounded-[6px] ${className}`} />;
}

/** Placeholder rows for a page or card while its data loads. */
export function SkeletonList({ label, rows = 3, compact = false }: { label: string; rows?: number; compact?: boolean }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 rounded-item border border-line bg-surface/70 ${compact ? "p-2.5" : "p-4"}`}
        >
          {!compact && <Skeleton className="h-8 w-8 shrink-0 rounded-[8px]" />}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={`h-3 ${index % 2 ? "w-2/5" : "w-1/2"}`} />
            {!compact && <Skeleton className={`h-3 ${index % 2 ? "w-4/5" : "w-3/4"}`} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <span className="relative flex h-14 w-14 items-center justify-center">
      <svg viewBox="0 0 56 56" className="otp-orbit absolute inset-0" aria-hidden="true">
        <circle cx="28" cy="28" r="26" fill="none" stroke="rgb(22 22 22 / 0.08)" strokeWidth="2" />
        <path d="M28 2a26 26 0 0 1 26 26" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="12" fill="#ff9fff" />
        <g transform="translate(12 12)">
          <MarkGlyph />
        </g>
      </svg>
    </span>
  );
}

const STEPS = ["Checking your sign-in", "Loading your workspace", "Preparing your dashboard"];

/** Full-screen loader shown while the app signs in and loads the workspace. */
export function AppLoader({ step }: { step: 0 | 1 | 2 }) {
  return (
    <div className="flex min-h-dvh w-full" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{STEPS[step]}</span>
      <aside aria-hidden="true" className="hidden w-[272px] shrink-0 flex-col gap-4 border-r border-line p-3 md:flex">
        <div className="flex items-center gap-2 rounded-item border border-line bg-surface/70 p-2">
          <Skeleton className="h-8 w-8 rounded-[8px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-2.5 w-3/5" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
        <div className="flex flex-col gap-3 px-2 pt-1">
          {[70, 55, 62, 48, 58, 40].map((width, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-[4px]" />
              <div className="otp-skeleton h-2.5 rounded-[6px]" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 px-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden="true" className="flex flex-col gap-6 px-4 py-8 opacity-60 md:px-8 md:pt-12">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="mx-auto grid w-full max-w-[880px] gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex flex-col gap-3 rounded-card border border-line bg-surface/70 p-5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-7 w-2/3" />
              </div>
            ))}
          </div>
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3 rounded-card border border-line bg-surface/70 p-5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 px-4">
          <div className="flex w-full max-w-[320px] flex-col items-center gap-5 rounded-card border border-line bg-surface p-6 shadow-[0_12px_40px_-12px_rgb(16_16_16_/_0.18)]">
            <Spinner />
            <ol className="flex w-full flex-col gap-2.5">
              {STEPS.map((label, index) => {
                const done = index < step;
                const active = index === step;
                return (
                  <li key={label} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        done ? "bg-ink text-white" : active ? "border-2 border-accent" : "border border-line"
                      }`}
                    >
                      {done && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className={done ? "text-muted" : active ? "font-medium text-ink" : "text-faint"}>{label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="h-1 w-full overflow-hidden rounded-full bg-fill" aria-hidden="true">
              <div className="otp-bar h-full w-2/5 rounded-full bg-accent" />
            </div>
            <p className="font-mono text-[11px] tracking-wide text-faint uppercase">Encrypted session · opentopost</p>
          </div>
        </div>
      </div>
    </div>
  );
}
