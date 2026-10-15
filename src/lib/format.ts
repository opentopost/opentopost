const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(timestamp: number) {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function weekLabel(weekOf: string) {
  const date = new Date(`${weekOf}T00:00:00Z`);
  return `Week of ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  if (error && typeof error === "object" && "data" in error && typeof error.data === "string") return error.data;
  return fallback;
}
