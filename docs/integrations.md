# Integrations

Every connection only reads, except publishing to LinkedIn and the Slack messages opentopost sends to your team.

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

