import type { MetadataRoute } from "next";
import { PAGES, SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PAGES).map((page) => ({
    url: `${SITE.url}${page.path === "/" ? "" : page.path}`,
    changeFrequency: "weekly",
    priority: page.path === "/" ? 1 : 0.8,
  }));
}
