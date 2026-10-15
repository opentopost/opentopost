"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MobileAuthAction } from "./auth-actions";

export function MobileMenu({
  links,
  repoUrl,
  stars,
}: {
  links: { href: string; label: string }[];
  repoUrl: string;
  stars?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((value) => !value)}
        className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-fill"
      >
        {open ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-14 bottom-0 z-40 flex flex-col gap-1 border-t border-line bg-canvas px-5 py-4"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className="border-b border-line py-4 text-[18px] text-ink aria-[current=page]:text-accent"
              >
                {link.label}
              </Link>
            ))}
            <a href={repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-b border-line py-4 text-[18px] text-ink">
              GitHub
              {stars}
            </a>
          </nav>
          <div className="mt-auto flex flex-col gap-2 pb-4">
            <MobileAuthAction />
          </div>
        </div>
      )}
    </div>
  );
}
