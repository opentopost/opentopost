import Image from "next/image";
import { SITE } from "@/lib/site";

const HOST = new URL(SITE.url).host;

export const SCREENS = {
  ideas: { src: "/screens/ideas.png", width: 3456, height: 2166, alt: "The Ideas page: scored post ideas from the team's notes, each with its source and proof" },
  moments: { src: "/screens/moments.png", width: 3456, height: 2164, alt: "The Moments page: true things the team did, each fact with its exact quote and source" },
  draft: { src: "/screens/draft.png", width: 3456, height: 2168, alt: "A company page draft with three hooks, a LinkedIn preview, and every claim traced to its source" },
  voice: { src: "/screens/voice.png", width: 3456, height: 2166, alt: "A voice profile built from posts, a tweet screenshot, and a blog post, with version history" },
  calendar: { src: "/screens/calendar.png", width: 3456, height: 2166, alt: "The Calendar: a week of scheduled and posted drafts, and LinkedIn publishing" },
  recap: { src: "/screens/recap.png", width: 3456, height: 2166, alt: "The weekly recap: posts, link clicks, signups, top posts, and who posted" },
} as const;

export type ScreenName = keyof typeof SCREENS;

/** A real screenshot of the app in a browser frame. */
export function Screen({ name, path, priority = false, className = "" }: { name: ScreenName; path: string; priority?: boolean; className?: string }) {
  const screen = SCREENS[name];
  return (
    <figure
      className={`overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_40px_80px_-40px_rgb(16_16_16/0.45)] ${className}`}
    >
      <div className="flex h-9 items-center gap-3 border-b border-line bg-canvas px-3" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
          <span className="size-2.5 rounded-full bg-ink/15" />
        </span>
        <span className="mx-auto max-w-[60%] truncate rounded-[6px] bg-fill px-3 py-0.5 font-mono text-[11px] text-muted">
          {HOST}/{path}
        </span>
        <span className="w-[42px]" />
      </div>
      <Image
        src={screen.src}
        width={screen.width}
        height={screen.height}
        alt={screen.alt}
        priority={priority}
        sizes="(min-width: 1148px) 1100px, 100vw"
        className="block h-auto w-full"
      />
    </figure>
  );
}
