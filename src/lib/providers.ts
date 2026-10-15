export const PROVIDERS = ["google", "anthropic", "openai", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const TASKS = ["scan", "draft", "score"] as const;
export type Task = (typeof TASKS)[number];

export const PROVIDER_INFO: Record<
  Provider,
  { name: string; keyUrl: string; keySite: string; placeholder: string }
> = {
  google: {
    name: "Gemini",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keySite: "Google AI Studio",
    placeholder: "AIza...",
  },
  anthropic: {
    name: "Claude",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keySite: "the Claude Console",
    placeholder: "sk-ant-...",
  },
  openai: {
    name: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keySite: "the OpenAI platform",
    placeholder: "sk-...",
  },
  openrouter: {
    name: "OpenRouter",
    keyUrl: "https://openrouter.ai/keys",
    keySite: "OpenRouter",
    placeholder: "sk-or-...",
  },
};

export const TASK_INFO: Record<Task, { name: string; help: string }> = {
  scan: { name: "Find ideas", help: "Reads your sources. A fast model with a large context works best." },
  score: { name: "Score ideas", help: "Ranks each idea. A fast model is enough." },
  draft: { name: "Write drafts", help: "Writes posts in your voice. Use the best model you have." },
};
