export const FAQ = [
  {
    q: "What is opentopost?",
    a: "opentopost is the open-source distribution layer for startup teams. It reads what your team ships in GitHub, Slack, Linear, Notion, and 7 more, writes a post for the person who did the work, and shows which posts brought signups.",
  },
  {
    q: "Is opentopost free?",
    a: "The Free plan and self-hosting cost nothing. You bring your own model key and pay your provider, and Gemini has a free tier. Pro costs $19 a month and Team costs $15 per member a month. Both include Claude models, so you need no key.",
  },
  {
    q: "Why do I need my own model key?",
    a: "You only need one on the Free plan or a self-hosted copy. Your key pays for the model calls, and you choose the provider and the models. Pro and Team include the models.",
  },
  {
    q: "Does it post to LinkedIn for me?",
    a: "Yes, if you connect LinkedIn. Approved posts on your own profile publish at the next posting time, or at the time you choose. If an admin turns on autopilot, drafts with a source for every claim are scheduled without a click. Company page posts send a reminder to the right person, because LinkedIn does not let apps post to company pages for you.",
  },
  {
    q: "Can my AI agents use it?",
    a: "Yes. opentopost has an MCP server, a REST API, and signed webhooks. An agent with an API key can find ideas, write and revise drafts, ask for review, schedule posts, and read recaps, with the same rules and audit log as the app.",
  },
  {
    q: "Is it really open source?",
    a: "Yes. The code is on GitHub under the AGPL-3.0 license. You can read it, run it, and change it. If you run a changed copy as a service for others, you must share your changes.",
  },
  {
    q: "Can I use Claude instead of Gemini?",
    a: "Yes. Add a Claude, OpenAI, or OpenRouter key in settings and choose which provider to use. You can change it at any time.",
  },
  {
    q: "What are the limits on the hosted version?",
    a: "One workspace, five members, one scheduled scan each week, two sources, and one MCP server. A self-hosted copy has no limits.",
  },
  {
    q: "What do I need to self-host?",
    a: "A Convex account and a Kinde account. Both have free plans. The self-hosting guide in the GitHub repository walks through each step.",
  },
  {
    q: "How is my key stored?",
    a: "A Convex action checks the key with the provider, then encrypts it with AES-256-GCM. No query returns it. The app shows only the last four characters.",
  },
];
