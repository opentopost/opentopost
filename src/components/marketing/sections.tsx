import { ArrowRight, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Check, Eyebrow } from "../ui";

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {columns.map((column, index) => (
        <div key={index} className="flex flex-col gap-3">
          {column.map((item) => (
            <details
              key={item.q}
              className="group rounded-[12px] border border-line bg-surface/40 open:bg-surface/80"
            >
              <summary className="flex cursor-pointer items-start gap-3 px-4 py-3 text-[16px] text-ink">
                <Plus
                  size={16}
                  strokeWidth={1.75}
                  className="mt-1 shrink-0 transition-transform group-open:rotate-45"
                />
                {item.q}
              </summary>
              <div className="px-4 pb-4 pl-11 text-[14px] leading-relaxed text-body">{item.a}</div>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}

type Cell = boolean | string;

export function CompareTable({
  corner,
  columns,
  rows,
  highlight,
}: {
  corner: string;
  columns: { title: string; note?: string }[];
  rows: { label: string; note?: string; cells: Cell[] }[];
  highlight?: number;
}) {
  const cell = (value: Cell) =>
    value === true ? (
      <Check className="mx-auto" />
    ) : value === false ? (
      <span className="text-faint" aria-label="No">
        ×
      </span>
    ) : (
      <span className="text-[14px] text-ink">{value}</span>
    );
  const hl = (index: number) => (index === highlight ? "bg-surface" : "");
  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-[34%] p-4 text-[20px] font-normal tracking-[-0.01em]">
              {corner}
            </th>
            {columns.map((column, index) => (
              <th
                key={column.title}
                scope="col"
                className={`border-l border-line p-4 text-center font-normal ${
                  index === highlight ? "bg-butter" : ""
                }`}
              >
                <span className="block text-[16px] text-ink">{column.title}</span>
                {column.note && <span className="block text-[12px] text-muted">{column.note}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="p-4 font-normal">
                <span className="block text-[14px] font-medium text-ink">{row.label}</span>
                {row.note && <span className="block text-[14px] text-muted">{row.note}</span>}
              </th>
              {row.cells.map((value, index) => (
                <td key={index} className={`border-l border-line p-4 text-center ${hl(index)}`}>
                  {cell(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Flow({ steps }: { steps: { label: string; note: string; tone?: "accent" | "sky" | "plain" }[] }) {
  const tones = {
    accent: "border-accent bg-accent-soft/60",
    sky: "border-sky-deep/40 bg-sky",
    plain: "border-line bg-surface",
  };
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <li key={step.label} className="flex flex-col items-start gap-2">
          <div className={`w-full rounded-item border px-4 py-3 ${tones[step.tone ?? "plain"]}`}>
            <p className="text-[14px] font-medium text-ink">{step.label}</p>
            <p className="text-[14px] text-muted">{step.note}</p>
          </div>
          {index < steps.length - 1 && (
            <ArrowRight size={16} strokeWidth={1.75} className="ml-4 rotate-90 text-faint" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

export function StepList({ steps }: { steps: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4 border-t border-line py-5 first:border-t-0 first:pt-0">
          <span className="w-8 shrink-0 font-mono text-[14px] text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[16px] text-ink">{step.title}</p>
            <div className="text-[14px] leading-relaxed text-muted">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PageHero({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-6 pt-16 pb-12 md:grid-cols-[1.2fr_1fr] md:items-end md:gap-16 md:pt-20">
      <div className="flex flex-col gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-[40px] leading-[1.12] tracking-[-0.03em] md:text-display">{title}</h1>
      </div>
      <div className="flex flex-col gap-5 md:pb-2">
        <p className="text-lead text-body">{body}</p>
        {children}
      </div>
    </div>
  );
}
