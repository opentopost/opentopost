/** Routes inside the signed-in app. The site's cookie banner and ad pixels stay out of these. */
export const APP_PREFIXES = ["/dashboard", "/ideas", "/moments", "/drafts", "/calendar", "/review", "/recap", "/sources", "/voice", "/company", "/settings", "/onboarding", "/start", "/invite", "/billing", "/insights"];

export function isAppPath(path: string) {
  return APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
