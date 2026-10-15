export const PROVIDERS = ["google", "anthropic", "openai", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const TASKS = ["scan", "draft", "score"] as const;
export type Task = (typeof TASKS)[number];

export type Capabilities = {
  searchGrounding: boolean;
  longContextScan: boolean;
  embeddings: boolean;
};

export const CAPABILITIES: Record<Provider, Capabilities> = {
  google: { searchGrounding: true, longContextScan: true, embeddings: true },
  anthropic: { searchGrounding: false, longContextScan: false, embeddings: false },
  openai: { searchGrounding: false, longContextScan: false, embeddings: true },
  openrouter: { searchGrounding: false, longContextScan: false, embeddings: false },
};

export type KeyCheck =
  | { ok: true; models: string[] }
  | { ok: false; message: string };

type ModelList = { data?: { id: string }[] };

async function failure(provider: string, response: Response): Promise<KeyCheck> {
  if (response.status === 401 || response.status === 403 || response.status === 400) {
    return { ok: false, message: `${provider} did not accept this key.` };
  }
  if (response.status === 429) {
    return {
      ok: false,
      message: `${provider} rate limited this check. Wait a minute, then try again.`,
    };
  }
  return {
    ok: false,
    message: `${provider} returned an error (${response.status}). Try again.`,
  };
}

async function checkGoogle(apiKey: string): Promise<KeyCheck> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    { headers: { "x-goog-api-key": apiKey } },
  );
  if (!response.ok) return failure("Gemini", response);
  const body = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  const models = (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  return { ok: true, models };
}

async function checkAnthropic(apiKey: string): Promise<KeyCheck> {
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  });
  if (!response.ok) return failure("Anthropic", response);
  const body = (await response.json()) as ModelList;
  return { ok: true, models: (body.data ?? []).map((m) => m.id) };
}

async function checkOpenAI(apiKey: string): Promise<KeyCheck> {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) return failure("OpenAI", response);
  const body = (await response.json()) as ModelList;
  return { ok: true, models: (body.data ?? []).map((m) => m.id) };
}

async function checkOpenRouter(apiKey: string): Promise<KeyCheck> {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const key = await fetch("https://openrouter.ai/api/v1/key", { headers });
  if (!key.ok) return failure("OpenRouter", key);
  const response = await fetch("https://openrouter.ai/api/v1/models", { headers });
  if (!response.ok) return failure("OpenRouter", response);
  const body = (await response.json()) as ModelList;
  return { ok: true, models: (body.data ?? []).map((m) => m.id) };
}

export async function checkKey(provider: Provider, apiKey: string): Promise<KeyCheck> {
  try {
    const check = await {
      google: checkGoogle,
      anthropic: checkAnthropic,
      openai: checkOpenAI,
      openrouter: checkOpenRouter,
    }[provider](apiKey);
    return check.ok ? { ok: true, models: check.models.sort() } : check;
  } catch {
    return { ok: false, message: "Could not reach the provider. Try again." };
  }
}
