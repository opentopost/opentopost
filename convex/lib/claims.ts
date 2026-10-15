export type Fact = { id: string; text: string; quote?: string };
export type Claim = {
  text: string;
  factIds: string[];
  status: "supported" | "unsupported" | "rule";
  note?: string;
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteFound(quote: string, source: string): boolean {
  const needle = normalize(quote);
  return needle.length >= 8 && normalize(source).includes(needle);
}

const NUMBER = /(?<![\w.])(\d[\d,]*(?:\.\d+)?)(\s?%|x\b|k\b|m\b)?/gi;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;

/** Numbers in the text, ignoring links: a port or a short-link code is not a claim. */
function numbersIn(text: string): string[] {
  return [...text.replace(URL_PATTERN, " ").matchAll(NUMBER)].map((match) => match[1].replace(/,/g, ""));
}

export function unsupportedNumbers(draft: string, facts: Fact[]): Claim[] {
  const known = new Set(facts.flatMap((fact) => numbersIn(`${fact.text} ${fact.quote ?? ""}`)));
  const seen = new Set<string>();
  const out: Claim[] = [];
  for (const sentence of draft.split(/(?<=[.!?])\s+|\n+/)) {
    for (const value of numbersIn(sentence)) {
      if (known.has(value) || seen.has(value) || value.length < 2) continue;
      seen.add(value);
      out.push({
        text: sentence.trim(),
        factIds: [],
        status: "unsupported",
        note: `The number ${value} does not appear in the sources.`,
      });
    }
  }
  return out;
}

export function cleanClaims(claims: Claim[], facts: Fact[], draft: string): Claim[] {
  const ids = new Set(facts.map((fact) => fact.id));
  const cleaned = claims
    .filter((claim) => claim.text.replace(URL_PATTERN, "").trim())
    .map((claim) => {
      if (claim.status === "rule") return claim;
      const factIds = claim.factIds.filter((id) => ids.has(id));
      return { ...claim, factIds, status: factIds.length ? ("supported" as const) : ("unsupported" as const) };
    });
  const flagged = new Set(
    cleaned.filter((claim) => claim.status !== "supported").flatMap((claim) => numbersIn(claim.text)),
  );
  return [
    ...cleaned,
    ...unsupportedNumbers(draft, facts).filter((claim) => !numbersIn(claim.text).some((value) => flagged.has(value))),
  ];
}

const MULTIPLIER = /\b(doubl\w*|tripl\w*|quadrupl\w*|halv\w*|\d+(?:\.\d+)?x)\b/gi;

/** True when text adds numbers or multipliers ("triple", "10x") that the facts do not contain. */
export function overstates(text: string, facts: Fact[]): boolean {
  const source = facts.map((fact) => `${fact.text} ${fact.quote ?? ""}`).join(" ");
  const known = new Set(numbersIn(source));
  if (numbersIn(text).some((value) => !known.has(value))) return true;
  const sourceLower = source.toLowerCase();
  return [...text.matchAll(MULTIPLIER)].some((match) => !sourceLower.includes(match[1].toLowerCase()));
}

/** Keeps text only when it adds nothing to the facts; otherwise returns the first clean fallback. */
export function grounded(text: string, facts: Fact[], ...fallbacks: string[]): string {
  if (!overstates(text, facts)) return text;
  return fallbacks.find((candidate) => candidate && !overstates(candidate, facts)) ?? facts[0]?.text ?? text;
}
