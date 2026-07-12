import * as zod from "zod";

export const ListModRequestsResponseItem = zod.object({
  id: zod.number(),
  mcVersion: zod.string(),
  modLoader: zod.enum(["forge", "fabric", "neoforge", "quilt"]),
  prompt: zod.string(),
  title: zod.string(),
  status: zod.enum(["pending", "completed", "refused", "failed"]),
  summary: zod.string(),
  resultMarkdown: zod.string(),
  createdAt: zod.coerce.date(),
});
export const ListModRequestsResponse = zod.array(ListModRequestsResponseItem);

export const createModRequestBodyPromptMin = 3;
export const createModRequestBodyPromptMax = 4000;

export const CreateModRequestBody = zod.object({
  mcVersion: zod.string().min(1),
  modLoader: zod.enum(["forge", "fabric", "neoforge", "quilt"]),
  prompt: zod
    .string()
    .min(createModRequestBodyPromptMin)
    .max(createModRequestBodyPromptMax),
});

export const CreateModRequestResponse = zod.object({
  id: zod.number(),
  mcVersion: zod.string(),
  modLoader: zod.enum(["forge", "fabric", "neoforge", "quilt"]),
  prompt: zod.string(),
  title: zod.string(),
  status: zod.enum(["pending", "completed", "refused", "failed"]),
  summary: zod.string(),
  resultMarkdown: zod.string(),
  createdAt: zod.coerce.date(),
});

export const GetModRequestParams = zod.object({
  id: zod.coerce.number(),
});

export const GetModRequestResponse = zod.object({
  id: zod.number(),
  mcVersion: zod.string(),
  modLoader: zod.enum(["forge", "fabric", "neoforge", "quilt"]),
  prompt: zod.string(),
  title: zod.string(),
  status: zod.enum(["pending", "completed", "refused", "failed"]),
  summary: zod.string(),
  resultMarkdown: zod.string(),
  createdAt: zod.coerce.date(),
});

export const DeleteModRequestParams = zod.object({
  id: zod.coerce.number(),
});

export const GetModStatsResponse = zod.object({
  totalMods: zod.number(),
  byVersion: zod.array(
    zod.object({ label: zod.string(), count: zod.number() }),
  ),
  byLoader: zod.array(
    zod.object({ label: zod.string(), count: zod.number() }),
  ),
});

export const HealthCheckResponse = zod.object({
  status: zod.string(),
});
