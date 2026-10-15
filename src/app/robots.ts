import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const APP_PATHS = ["/dashboard", "/ideas", "/drafts", "/sources", "/voice", "/settings", "/onboarding", "/start", "/invite", "/moments", "/review", "/recap", "/r/", "/api"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: APP_PATHS }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
