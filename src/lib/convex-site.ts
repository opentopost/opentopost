/** The Convex HTTP actions address (…convex.site) for this deployment. */
export function convexSiteUrl(): string | null {
  const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (site) return site.replace(/\/$/, "");
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  return cloud ? cloud.replace(".convex.cloud", ".convex.site").replace(/\/$/, "") : null;
}
