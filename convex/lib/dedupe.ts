import type { Doc } from "../_generated/dataModel";

type MomentLike = Pick<Doc<"moments">, "title" | "facts">;

const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The quotes and title that identify a moment. Two moments that share any of them describe the same event. */
export function momentKeys(moment: MomentLike): string[] {
  const keys = [`t:${norm(moment.title)}`];
  for (const fact of moment.facts) {
    const quote = fact.quote ? norm(fact.quote) : "";
    if (quote.length >= 24) keys.push(`q:${quote}`);
  }
  return keys;
}

/** Keeps the first moment of each group that describes the same event. Pass moments in the order to prefer. */
export function uniqueMoments<T extends MomentLike>(moments: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const moment of moments) {
    const keys = momentKeys(moment);
    if (keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    kept.push(moment);
  }
  return kept;
}
