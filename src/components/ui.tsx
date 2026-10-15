import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-deep",
  secondary: "border border-line bg-surface/60 text-ink hover:bg-surface",
  dark: "bg-ink text-white hover:bg-body",
  ghost: "text-ink hover:bg-fill",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:border-danger/50 hover:bg-danger/15",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[14px]",
  md: "h-9 px-3.5 text-[14px]",
  lg: "h-11 px-5 text-[16px]",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "sm", extra = "") =>
  `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 ${SIZES[size]} ${VARIANTS[variant]} ${extra}`;

export function Button({
  variant = "primary",
  size = "sm",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={`rounded-card border border-line bg-surface/80 ${className}`}>{children}</Tag>
  );
}

export function Eyebrow({
  children,
  tone = "accent",
  className = "",
}: {
  children: ReactNode;
  tone?: "accent" | "sky" | "muted";
  className?: string;
}) {
  const tones = { accent: "text-accent", sky: "text-sky-deep", muted: "text-muted" };
  return (
    <p className={`font-mono text-[14px] uppercase ${tones[tone]} ${className}`}>{children}</p>
  );
}

export function Badge({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: "lime" | "accent" | "fill" | "danger";
}) {
  const tones = {
    lime: "bg-lime text-lime-ink",
    accent: "bg-accent-soft text-accent-deep",
    fill: "bg-fill text-body",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[4px] px-1.5 text-[12px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-item px-3 py-2 text-[14px] ${
        tone === "ok" ? "bg-lime text-lime-ink" : "bg-danger-soft text-danger"
      }`}
    >
      {children}
    </p>
  );
}

export const fieldClass =
  "h-9 min-w-0 rounded-control border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export const inputClass = `${fieldClass} w-full`;

export function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={`text-accent ${className}`}>
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export const textareaClass =
  "w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-[14px] leading-relaxed text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-medium tracking-[-0.02em]">{title}</h1>
        {description && <p className="max-w-[560px] text-[14px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid-faint flex flex-col items-center gap-3 rounded-card border border-line px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-[25%] bg-accent-mid text-ink">{icon}</span>
      <h2 className="mt-2 text-[18px] font-medium">{title}</h2>
      <p className="max-w-[400px] text-[14px] text-muted">{body}</p>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}
