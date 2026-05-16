import type { JsonObject } from "../types.js";

export const anyMockValueSchema = { type: ["object", "array", "string", "number", "boolean", "null"] };

export function readMockConfig(config: unknown): JsonObject | null {
  const mock = config && typeof config === "object" ? (config as JsonObject).mock : undefined;
  if (!mock || typeof mock !== "object" || Array.isArray(mock)) return null;
  return (mock as JsonObject).enabled === true ? mock as JsonObject : null;
}

