const MAX_WORDS = 800;

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);

/**
 * How much of a text changed, from 0 (same) to 1 (all of it), by words.
 * It is the word edit distance divided by the longer text's word count.
 */
export function editShare(before: string, after: string): number {
  const a = words(before);
  const b = words(after);
  if (a.length === 0 && b.length === 0) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length] / Math.max(a.length, b.length);
}
