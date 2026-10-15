import { cacheLife } from "next/cache";

const REPO = "opentopost/opentopost";

async function starCount(): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "opentopost-site" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { stargazers_count?: number };
    return typeof body.stargazers_count === "number" ? body.stargazers_count : null;
  } catch {
    return null;
  }
}

function format(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(count);
}

/** The repository's star count, refreshed about once an hour. Shows nothing if GitHub does not answer. */
export async function GitHubStars({ className = "" }: { className?: string }) {
  const count = await starCount();
  if (count === null) return null;
  return (
    <span className={`rounded-full bg-fill px-1.5 py-px text-[12px] tabular-nums text-muted ${className}`} aria-label={`${count} stars on GitHub`}>
      ★ {format(count)}
    </span>
  );
}
