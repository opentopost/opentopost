/**
 * Fetches a link a user typed, without letting it reach private networks.
 * Each redirect is checked again, so a public link cannot bounce the request to a private address.
 */

const PRIVATE_V4 =
  /^(0\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|192\.0\.0\.\d+|198\.(1[89])\.\d+\.\d+|22[4-9]\.\d+\.\d+\.\d+|2[3-5]\d\.\d+\.\d+\.\d+)$/;
const PRIVATE_NAME = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa|metadata|metadata\.google\.internal)$/i;

/** True when a hostname is local, private, link-local, or a cloud metadata address. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!host) return true;
  if (PRIVATE_NAME.test(host)) return true;
  if (PRIVATE_V4.test(host)) return true;
  if (host.includes(":")) {
    // IPv6: loopback, unspecified, unique local, link local, and IPv4-mapped addresses.
    if (host === "::1" || host === "::") return true;
    if (/^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host)) return true;
    const mapped = host.match(/^::ffff:(.+)$/);
    if (mapped) {
      const tail = mapped[1];
      if (tail.includes(".")) return PRIVATE_V4.test(tail);
      const parts = tail.split(":").map((part) => parseInt(part, 16));
      if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
        const v4 = `${parts[0] >> 8}.${parts[0] & 255}.${parts[1] >> 8}.${parts[1] & 255}`;
        return PRIVATE_V4.test(v4);
      }
      return true;
    }
  }
  return false;
}

/** Throws when a link is not http(s), carries credentials, or points at a private host. */
export function checkPublicUrl(raw: string | URL, { httpsOnly = false, allowPrivate = false } = {}): URL {
  let url: URL;
  try {
    url = new URL(raw.toString().trim());
  } catch {
    throw new Error("Enter a full link that starts with https://.");
  }
  if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:"))
    throw new Error(httpsOnly ? "The link must start with https://." : "Enter a web link.");
  if (url.username || url.password) throw new Error("Links cannot carry a user name or password.");
  if (!allowPrivate && isPrivateHost(url.hostname)) throw new Error("Private and local addresses are not allowed.");
  return url;
}

const MAX_REDIRECTS = 5;

/** fetch() for user links: follows up to five redirects by hand and checks every hop. */
export async function safeFetch(
  raw: string | URL,
  init: RequestInit = {},
  options: { httpsOnly?: boolean; allowPrivate?: boolean } = {},
): Promise<Response> {
  let url = checkPublicUrl(raw, options);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) return response;
    url = checkPublicUrl(new URL(location, url), options);
  }
  throw new Error("The link redirected too many times.");
}
