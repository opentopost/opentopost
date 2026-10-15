import { generateText, Output } from "ai";
import type { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { getModel, type ResolvedModel } from "./model";
import { internal } from "../_generated/api";
import type { Provider, Task } from "./providers";

export type Usage = { input: number; output: number };

export type InputFile = { data: Uint8Array; mediaType: string };

export async function structured<T extends z.ZodType>(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces"> | null,
  task: Task,
  options: {
    instructions: string;
    prompt: string;
    schema: T;
    files?: InputFile[];
    media?: boolean;
    /** An exact model to use instead of the workspace's. Usage is not charged to the workspace. */
    model?: ResolvedModel;
  },
): Promise<{ output: z.infer<T>; usage: Usage; provider: Provider; modelId: string }> {
  if (!options.model && !workspaceId) throw new Error("A workspace or a model is needed.");
  const resolved = options.model ?? (await getModel(ctx, workspaceId!, task, options.media ?? false));
  const common = {
    model: resolved.model,
    instructions: options.instructions,
    output: Output.object({ schema: options.schema }),
    maxRetries: 4,
  };
  const result = options.files?.length
    ? await generateText({
        ...common,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: options.prompt },
              ...options.files.map((file) => ({ type: "file" as const, data: file.data, mediaType: file.mediaType })),
            ],
          },
        ],
      })
    : await generateText({ ...common, prompt: options.prompt });
  const usage = { input: result.usage.inputTokens ?? 0, output: result.usage.outputTokens ?? 0 };
  if (resolved.hosted && !options.model && workspaceId) {
    await ctx.runMutation(internal.billing.recordUsage, { workspaceId, ...usage });
  }
  return { output: result.output as z.infer<T>, usage, provider: resolved.provider, modelId: resolved.modelId };
}

/** The provider a workspace's next call will use, without making a call. */
export async function currentProvider(ctx: ActionCtx, workspaceId: Id<"workspaces">, task: Task, media = false): Promise<Provider> {
  const resolved = await ctx.runQuery(internal.modelConfig.resolve, { workspaceId, task, media });
  return resolved.provider;
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate.?limit|quota|resource.?exhausted/i.test(message)) {
    return "Your model provider rate limited this request. Wait a minute, then try again.";
  }
  if (/401|403|api key|unauthor/i.test(message)) {
    return "Your model provider did not accept the key. Test it in model settings.";
  }
  if (/not.?found|404|model/i.test(message) && /model/i.test(message)) {
    return "Your key cannot use the chosen model. Choose another model in settings.";
  }
  if (/Add a model key|Choose a|included AI/.test(message)) return message.replace(/^.*?Uncaught ConvexError: /, "");
  return "The model call failed. Try again.";
}

export function quote(tag: string, text: string): string {
  return `<${tag}>\n${text.replaceAll(`</${tag}>`, "")}\n</${tag}>`;
}
