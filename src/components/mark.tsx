import type { ReactNode } from "react";

export function MarkGlyph({ color = "#101010" }: { color?: string }) {
  return (
    <>
      <circle cx="12" cy="12" r="9.25" fill="none" stroke={color} strokeWidth="2.5" />
      <path d="M3.4 14.6A9.25 9.25 0 0 0 18.5 18.6" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <circle cx="12" cy="10" r="3" fill={color} />
    </>
  );
}

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <rect width="48" height="48" rx="12" fill="#ff9fff" />
      <g transform="translate(12 12)">
        <MarkGlyph />
      </g>
    </svg>
  );
}

export function Glyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <MarkGlyph color="currentColor" />
    </svg>
  );
}

export function IconTile({
  tone = "accent",
  size = 32,
  children,
}: {
  tone?: "accent" | "sky" | "butter" | "plain";
  size?: number;
  children: ReactNode;
}) {
  const tones = {
    accent: "bg-accent-mid text-ink",
    sky: "bg-sky-mid text-ink",
    butter: "bg-butter-mid text-ink",
    plain: "bg-surface text-ink border border-line",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[25%] ${tones[tone]}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={24} />
      <span className="text-[18px] font-semibold tracking-[-0.03em]">opentopost</span>
    </span>
  );
}
