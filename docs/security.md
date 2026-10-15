# Security, roles, and privacy

To report a vulnerability, read [SECURITY.md](../SECURITY.md).

## Roles, audit log, and retention

| Role | Can do |
| --- | --- |
| Owner | Everything, including billing, deleting the workspace, and making other owners |
| Admin | Settings, model keys, connections, API keys with the `admin` scope, company posts |
| Reviewer | Approve or return drafts, and their own drafts |
| Member | Their own drafts |

Every draft, review, schedule, post, key, webhook, role, and setting change is written to the audit log with who did it and whether it came from the app, the API, Slack, or the system. Owners and admins read it in Settings > Security.

Settings > Security also sets how many days source text is kept. A daily job removes older text. SSO, SCIM, and MFA are set up in Kinde.

## Analytics

The website and app send page views, clicks, scroll depth, and active time to `https://<your-deployment>.convex.site/t`. There are no cookies. Visitors with Do Not Track or Global Privacy Control on are not counted. Raw events are kept for 400 days.
