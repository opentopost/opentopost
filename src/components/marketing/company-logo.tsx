"use client";

import { useState } from "react";

/**
 * A company's logo from its domain, the same way devrel_studio does it: logo.dev when a token is set,
 * then the icon from the company's own home page, then Google's favicon service, then the first letter.
 */
export function CompanyLogo({ domain, iconUrl, name, size = 56 }: { domain: string; iconUrl?: string | null; name: string; size?: number }) {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const sources = [
    token ? `https://img.logo.dev/${domain}?token=${token}&size=${size * 2}&format=png` : null,
    iconUrl ?? null,
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
  ].filter((src): src is string => Boolean(src));
  const [index, setIndex] = useState(0);
  const box = { width: size, height: size };

  if (index >= sources.length) {
    return (
      <span style={box} className="grid place-items-center rounded-[14px] bg-ink text-[22px] font-medium text-white">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    <span style={box} className="grid place-items-center overflow-hidden rounded-[14px] border border-line bg-white p-2">
      {/* Plain img: the logo comes from the company's own site or a logo service, not from Next's image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={sources[index]}
        src={sources[index]}
        alt={`${name} logo`}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain"
        onError={() => setIndex((i) => i + 1)}
      />
    </span>
  );
}
