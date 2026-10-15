import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { decrypt } from "./crypto";
import { hostedApiKey } from "./plan";
import { CAPABILITIES, type Capabilities, type Provider, type Task } from "./providers";

export type ResolvedModel = {
  model: LanguageModel;
  provider: Provider;
  modelId: string;
  capabilities: Capabilities;
  hosted: boolean;
};

function build(provider: Provider, apiKey: string, modelId: string): LanguageModel {
  switch (provider) {
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
  }
}

export async function getModel(ctx: ActionCtx, workspaceId: Id<"workspaces">, task: Task, media = false): Promise<ResolvedModel> {
  const resolved = await ctx.runQuery(internal.modelConfig.resolve, { workspaceId, task, media });
  let apiKey: string;
  if (resolved.hosted) {
    const hostedKey = hostedApiKey(resolved.provider);
    if (!hostedKey) throw new Error("Add a model key in settings first.");
    apiKey = hostedKey;
  } else {
    apiKey = await decrypt(resolved.ciphertext, resolved.iv);
  }
  return {
    model: build(resolved.provider, apiKey, resolved.modelId),
    provider: resolved.provider,
    modelId: resolved.modelId,
    capabilities: CAPABILITIES[resolved.provider],
    hosted: resolved.hosted,
  };
}

/** A hosted model chosen by id, for the admin model comparison. Throws when the hosted key is not set. */
export function hostedModel(provider: Provider, modelId: string): ResolvedModel {
  const apiKey = hostedApiKey(provider);
  if (!apiKey) throw new Error(`No hosted key is set for ${provider}.`);
  return { model: build(provider, apiKey, modelId), provider, modelId, capabilities: CAPABILITIES[provider], hosted: true };
}
