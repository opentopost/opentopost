/** The read-only sources an owner can connect with a key or a link. Shared by the server and the Sources page. */

export const CONNECTOR_KINDS = ["rss", "linear", "jira", "notion", "gdrive", "intercom", "zendesk"] as const;
export type ConnectorKind = (typeof CONNECTOR_KINDS)[number];

export type ConnectorField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
  options?: { value: string; label: string }[];
};

export type ConnectorInfo = {
  kind: ConnectorKind;
  name: string;
  reads: string;
  help: string;
  fields: ConnectorField[];
  anonymised?: boolean;
};

export const CONNECTORS: Record<ConnectorKind, ConnectorInfo> = {
  linear: {
    kind: "linear",
    name: "Linear",
    reads: "Issues completed in the last 14 days, with their descriptions.",
    help: "In Linear, open Settings > Account > Security & access and create a personal API key. Its access matches yours, so use an account that can see only the teams you want read.",
    fields: [
      { key: "apiKey", label: "Personal API key", placeholder: "lin_api_...", secret: true },
      { key: "teams", label: "Team keys (optional)", placeholder: "ENG, WEB", optional: true },
    ],
  },
  jira: {
    kind: "jira",
    name: "Jira",
    reads: "Issues resolved in the last 14 days, with their descriptions.",
    help: "Create an API token at id.atlassian.com under Security > API tokens. Use the email of the account the token belongs to.",
    fields: [
      { key: "site", label: "Site", placeholder: "https://yourcompany.atlassian.net" },
      { key: "email", label: "Account email", placeholder: "you@company.com" },
      { key: "token", label: "API token", secret: true },
      { key: "projects", label: "Project keys (optional)", placeholder: "ENG, PLAT", optional: true },
    ],
  },
  notion: {
    kind: "notion",
    name: "Notion",
    reads: "Pages edited in the last 14 days that you shared with the integration.",
    help: "Create an internal integration at notion.so/my-integrations with read content access only. Then open each page or teamspace to read, choose Connections, and add the integration.",
    fields: [{ key: "token", label: "Internal integration secret", placeholder: "ntn_...", secret: true }],
  },
  gdrive: {
    kind: "gdrive",
    name: "Google Docs",
    reads: "Google Docs and text files in one folder, changed in the last 14 days.",
    help: "Share the folder with the reader email shown below, as a Viewer. opentopost reads only what is shared with that email.",
    fields: [{ key: "folder", label: "Folder link", placeholder: "https://drive.google.com/drive/folders/..." }],
  },
  rss: {
    kind: "rss",
    name: "RSS or changelog feed",
    reads: "Entries published in the last 14 days, such as release notes or blog posts.",
    help: "Paste the feed link of your changelog, release notes, or blog. Most changelog tools publish one.",
    fields: [{ key: "url", label: "Feed link", placeholder: "https://yourcompany.com/changelog/rss.xml" }],
  },
  intercom: {
    kind: "intercom",
    name: "Intercom",
    reads: "Conversations closed in the last 14 days. Customer names, emails, and phone numbers are removed before anything is saved.",
    help: "In the Intercom Developer Hub, create an app and copy its access token. Give it read access to conversations only.",
    anonymised: true,
    fields: [
      { key: "token", label: "Access token", secret: true },
      {
        key: "region",
        label: "Data region",
        options: [
          { value: "us", label: "United States" },
          { value: "eu", label: "Europe" },
          { value: "au", label: "Australia" },
        ],
      },
    ],
  },
  zendesk: {
    kind: "zendesk",
    name: "Zendesk",
    reads: "Tickets solved in the last 14 days. Customer names, emails, and phone numbers are removed before anything is saved.",
    help: "In Zendesk Admin Center, open Apps and integrations > APIs > Zendesk API, turn on token access, and add a token. Use the email of an agent who can read tickets.",
    anonymised: true,
    fields: [
      { key: "subdomain", label: "Subdomain", placeholder: "yourcompany" },
      { key: "email", label: "Agent email", placeholder: "agent@company.com" },
      { key: "token", label: "API token", secret: true },
    ],
  },
};
