import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={`grid gap-4 rounded-card border bg-surface/80 p-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8 ${
        tone === "danger" ? "border-danger/30" : "border-line"
      }`}
    >
      <div className="flex flex-col gap-1">
        <h2 className={`text-[15px] font-medium ${tone === "danger" ? "text-danger" : ""}`}>{title}</h2>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}
