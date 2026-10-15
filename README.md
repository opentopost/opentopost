# opentopost

opentopost is the distribution layer for startup teams. It reads what your team ships in GitHub, Slack, Linear, Notion, and 7 more, writes a post for the person who did the work, and shows which posts brought signups.

- Drafts for LinkedIn, X, changelogs, investor updates, and newsletters, in each person's voice and your company's.
- Every claim links to the quote behind it. Claims without a source are flagged.
- Review, roles, an audit log, SSO and SCIM through Kinde, and source retention.
- An MCP server, a REST API, and signed webhooks, so agents can run every step.
- Drafts in Slack by DM, publish on schedule, and signups by post from your site, HubSpot, or Attio.

A self-hosted copy is free. Bring a Claude, Gemini, OpenAI, or OpenRouter key. Gemini has a free tier.

opentopost is licensed under [AGPL-3.0](LICENSE). Prefer not to run it yourself? [opentopost.com](https://opentopost.com) is the hosted version.

## Stack

- Next.js App Router
- Convex for the database and server functions
- Kinde for sign-in
- Vercel AI SDK for the model providers

## Run it locally

1. Clone the repository and install the packages.

   ```bash
   git clone https://github.com/opentopost/opentopost.git
   cd opentopost
   ```

   ```bash
   npm install
   ```

2. Start Convex. The first run asks you to sign in and create a project. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Keep this terminal open.

   ```bash
   npx convex dev
   ```

3. Create a Kinde application of type "Back-end web". Add these URLs in the application settings:

   - Allowed callback URL: `http://localhost:3000/api/auth/kinde_callback`
   - Allowed logout redirect URL: `http://localhost:3000`

4. Copy the Kinde values from `.env.example` into `.env.local` and fill them in.

5. Set three values on the Convex deployment.

   ```bash
   npx convex env set KINDE_ISSUER_URL https://<your-subdomain>.kinde.com
   npx convex env set KINDE_CLIENT_ID <client id>
   npx convex env set SECRETS_MASTER_KEY "$(openssl rand -base64 32)"
   ```

6. Start the app in a second terminal.

   ```bash
   npm run dev
   ```

Open `http://localhost:3000`, create an account, and add a model key.

## How keys are stored

A Convex action checks each key with the provider, then encrypts it with AES-256-GCM. The master key is the `SECRETS_MASTER_KEY` value on the Convex deployment. No query returns a key. The app shows the provider name and the last four characters only.

## Connect Slack

Slack is optional. Each copy of opentopost needs its own Slack app.

1. Go to https://api.slack.com/apps, click "Create New App", and choose "From an app manifest".
2. Paste this manifest. Replace `<deployment>` with your Convex deployment name, which is in `NEXT_PUBLIC_CONVEX_URL`.

   ```yaml
   display_information:
     name: opentopost
   features:
     app_home:
       messages_tab_enabled: true
       messages_tab_read_only_enabled: false
     bot_user:
       display_name: opentopost
   oauth_config:
     redirect_urls:
       - https://<deployment>.convex.site/slack/oauth
     scopes:
       bot:
         - channels:history
         - channels:read
         - channels:join
         - chat:write
         - team:read
         - users:read
         - users:read.email
         - im:write
         - im:history
   settings:
     event_subscriptions:
       request_url: https://<deployment>.convex.site/slack/events
       bot_events:
         - message.im
     interactivity:
       is_enabled: true
       request_url: https://<deployment>.convex.site/slack/interactions
   ```

3. Copy the client ID, client secret, and signing secret from "Basic Information", then set them on Convex:

   ```bash
   npx convex env set SLACK_CLIENT_ID <client id>
   npx convex env set SLACK_CLIENT_SECRET <client secret>
   npx convex env set SLACK_SIGNING_SECRET <signing secret>
   npx convex env set SITE_URL http://localhost:3000
   ```

4. In opentopost, open Sources, click "Connect Slack", and choose the channels to read.

When a draft is ready, opentopost sends it to its author by Slack DM with **Approve and schedule**, **Edit**, **Pass**, and **Open** buttons. A reply in the DM thread asks for a revision. The person who connects Slack is linked to their own Slack account. Everyone else is found by the email on their opentopost account, so it must match their Slack email.

If you made the Slack app before October 2026, add the `im:write` and `im:history` scopes, turn on **App Home > Messages Tab** with "Allow users to send Slash commands and messages from the messages tab", turn on **Event Subscriptions** with the request URL `https://<deployment>.convex.site/slack/events`, subscribe to the `message.im` bot event, then reinstall the app and connect Slack again in opentopost.

## Connect GitHub

opentopost reads merged pull requests and releases through a GitHub App. Each customer installs it on the repositories they choose.

1. On GitHub, open **Settings > Developer settings > GitHub Apps > New GitHub App**.
2. Set the **Callback URL** and the **Setup URL** to `https://<your-deployment>.convex.site/github/setup`. Turn on **Request user authorization (OAuth) during installation** and **Redirect on update**. opentopost uses that sign-in to check that the person really can see the installation.
3. Turn off **Webhook**.
4. Under **Repository permissions**, set **Pull requests** and **Contents** to **Read-only**. Contents is needed to read releases. opentopost never reads code.
5. Create the app, then generate a private key.
6. Set these on Convex:

```bash
npx convex env set GITHUB_APP_ID <app id>
npx convex env set GITHUB_APP_SLUG <the app name in its URL>
npx convex env set GITHUB_APP_CLIENT_ID <client id>
npx convex env set GITHUB_APP_CLIENT_SECRET <client secret>
npx convex env set -- GITHUB_APP_PRIVATE_KEY "$(cat path/to/private-key.pem)"
```

## Connect MCP servers

Owners add remote MCP servers on the Sources page with a URL and an optional auth header. The auth value is encrypted. opentopost only runs tools that read: a tool counts as read-only when the server marks it `readOnlyHint` or its name starts with a read verb such as `get`, `list`, or `search`. Each scan runs the tools you choose with the fixed input you set. The model never calls tools, so text in a source cannot make opentopost change anything. On the hosted version, private and local addresses are refused.

## Connect more sources

Owners connect Linear, Jira, Notion, RSS feeds, Intercom, and Zendesk on the Sources page with a key or a link. Each key is checked with the service, then encrypted. Every connection only reads. Intercom and Zendesk text has customer names, emails, and phone numbers removed before it is saved. Meeting recorders such as Granola, Fireflies, and Gong connect through their MCP servers.

Google Docs uses one Google service account. People share a Drive folder with its email as a Viewer.

1. In Google Cloud, turn on the Google Drive API and create a service account. It needs no roles.
2. Create a JSON key for it.
3. Set it on Convex:

```bash
npx convex env set GOOGLE_SERVICE_ACCOUNT_JSON "$(cat path/to/service-account.json)"
```

## Publish to LinkedIn and schedule posts

Scheduled posts on a person's own profile can publish on their own. Company page posts send a reminder, because LinkedIn only lets approved partner apps post to company pages.

1. Create an app at [developer.linkedin.com](https://developer.linkedin.com). LinkedIn asks you to link it to a company page.
2. On the **Products** tab, add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
3. On the **Auth** tab, add the redirect URL `https://<your-deployment>.convex.site/linkedin/oauth`.
4. Set these on Convex:

```bash
npx convex env set LINKEDIN_CLIENT_ID <client id>
npx convex env set LINKEDIN_CLIENT_SECRET <client secret>
```

LinkedIn tokens last 60 days. The Calendar page shows when each person needs to connect again.

Approved posts on a person's own profile are scheduled for the next weekday at the workspace's posting hour, in its time zone. Change the hour in Settings > Publishing. Posts publish if the author has connected LinkedIn. Otherwise the author gets a reminder.

**Autopilot** (Settings > Publishing, owners and admins) schedules a draft as soon as it is ready, without a click, when all of these are true: it is a personal LinkedIn post, every claim has a source, the workspace does not need review, and the author has connected LinkedIn.

## Track signups

Each draft can track links. A tracked link counts clicks, then sends the reader on with UTM tags. To count signups, demos, and job applications, create a workspace key in Settings > General and add the snippet it shows to your own site.

### HubSpot and Attio

Owners and admins connect a CRM in Settings > Pipeline. opentopost reads new and changed contacts every hour and counts a signup for the post whose tracked link brought each contact.

- **HubSpot:** create a private app with the `crm.objects.contacts.read` scope and paste its token. opentopost reads each contact's first and last page seen. Contacts in the sales qualified lead or opportunity stage count as demos.
- **Attio:** create an API key with read access to people records, and name the attribute that stores the `utm_content` value from your sign-up form. The default is `utm_content`.

## Agents, MCP, and the REST API

Every step works from an agent. Create an API key in Settings > API and agents. A key acts as the member who made it, with the scopes you choose: `read`, `draft`, `publish`, and `admin` (owners and admins only). opentopost stores only a SHA-256 hash of each key.

- **MCP:** `POST https://<your site>/mcp` with `Authorization: Bearer otp_...`. Streamable HTTP with JSON responses.
- **REST:** `GET https://<your site>/api/v1` lists the 18 tools with their scopes and input schemas. `POST https://<your site>/api/v1/<tool>` runs one with a JSON body and returns `{ "data": ... }` or `{ "error": "..." }`.

```bash
claude mcp add --transport http opentopost http://localhost:3000/mcp \
  --header "Authorization: Bearer otp_..."
```

The Next.js app forwards `/mcp` and `/api/v1` to the Convex site URL, so no extra setup is needed. The full guide is at `/docs/agents`.

## Webhooks

Add an https endpoint in Settings > API and agents. Events: `idea.created`, `draft.ready`, `draft.approved`, `draft.scheduled`, `post.published`, and `conversion.created`. Each request is a JSON `POST` with an `X-Opentopost-Event` header and an `X-Opentopost-Signature: t=<unix seconds>,v1=<hex>` header, where `v1` is the HMAC-SHA256 of `<t>.<raw body>` with the signing secret. Failed deliveries are tried again up to five times. On the hosted version, private and local addresses are refused.

## Roles, audit log, and retention

| Role | Can do |
| --- | --- |
| Owner | Everything, including billing, deleting the workspace, and making other owners |
| Admin | Settings, model keys, connections, API keys with the `admin` scope, company posts |
| Reviewer | Approve or return drafts, and their own drafts |
| Member | Their own drafts |

Every draft, review, schedule, post, key, webhook, role, and setting change is written to the audit log with who did it and whether it came from the app, the API, Slack, or the system. Owners and admins read it in Settings > Security.

Settings > Security also sets how many days source text is kept. A daily job removes older text. SSO, SCIM, and MFA are set up in Kinde.

## Distribution audit and insights

The Insights page has three views. **Distribution audit** lists the 10 best stories the team shipped in the last 30 days and never posted, with a link you can share. **Shipped vs told** compares moments found with posts published, per person. **Pipeline** scores ideas by how similar posts did for your team before.

## Paid plans (hosted only)

A self-hosted copy has no billing. Every feature is on, and there is nothing to set up here.

The hosted version has four plans: Free (bring your own key), Pro, Team, and Enterprise. Pro and Team run on Claude with our key.

```bash
npx convex env set DEPLOYMENT_MODE hosted
npx convex env set HOSTED_ANTHROPIC_API_KEY <a Claude key that pays for Pro and Team>
npx convex env set HOSTED_GOOGLE_API_KEY <optional: a Gemini key, used only to read voice recordings and videos>
```

Pro and Team use the `anthropic` rows in the `modelDefaults` table. To move every paid workspace to a newer model, change those rows. Pro includes 1,000 AI runs a month, and Team includes 500 per member. `aiUsage` records each run.

### Kinde Billing (when Stripe is connected)

Kinde Billing takes the payments through the [convex-kinde-billing](https://www.npmjs.com/package/convex-kinde-billing) component. Each paid workspace becomes a Kinde organization, and the organization is the billing customer.

1. In Kinde, open **Billing**, connect Stripe, and choose to bill organizations.
2. Create two organization plans and publish them:
   - `pro`: a fixed charge of $19 a month. For yearly billing, add a second plan `pro_yearly` at $180 a year.
   - `team`: a fixed charge of $45 a month, which includes three members, plus a metered feature with the key `extra_members` at $15 a unit.
3. In Kinde, open **Settings > Organizations** and let people create organizations when they sign up.
4. In Kinde, open **Settings > Webhooks** and add `https://<your-deployment>.convex.site/webhooks/kinde/billing`. Select all eight `customer.*` billing events.
5. Create a Kinde machine-to-machine app for the Kinde Management API. Give it the scopes to read organizations, record meter usage, and delete users.
6. Turn checkout on:

```bash
npx convex env set KINDE_BILLING on
npx convex env set KINDE_M2M_CLIENT_ID <client id>
npx convex env set KINDE_M2M_CLIENT_SECRET <client secret>
```

Then set `NEXT_PUBLIC_KINDE_BILLING=on` on Vercel. If your plan keys are different, set them as comma-separated lists: `KINDE_PLAN_PRO` (default `pro,pro_yearly`), `KINDE_PLAN_TEAM` (default `team,team_yearly`), and `KINDE_SEAT_FEATURE` (default `extra_members`). Plans you set by hand keep working.


The website and app send page views, clicks, scroll depth, and active time to `https://<your-deployment>.convex.site/t`. There are no cookies. Visitors with Do Not Track or Global Privacy Control on are not counted. Raw events are kept for 400 days.

## License

opentopost is licensed under the [GNU Affero General Public License v3.0](LICENSE). You can use, change, and self-host it. If you run a changed copy as a network service for other people, you must make your changes available to them under the same license.
