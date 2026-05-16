import type { ActionDefinition, JsonObject, WorkflowStep } from "../types.js";

interface FanoutInput {
  value?: unknown;
  branches: WorkflowStep[];
}

interface FanoutOutput {
  results: Array<{
    id: string;
    type: string;
    status: "success" | "failed";
    output: unknown;
    error: string | null;
  }>;
}

interface FaninInput {
  items: unknown[];
}

interface FaninOutput {
  strategy: "merge" | "first_success";
  output: unknown;
  count: number;
}

const branchSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "input"],
  properties: {
    id: { type: "string", minLength: 1 },
    type: { type: "string", minLength: 1 },
    input: {},
    config: { type: "object", nullable: true, additionalProperties: true },
  },
};

export const fanoutAction: ActionDefinition<FanoutInput, FanoutOutput> = {
  type: "control.fanout",
  description: "Run multiple action branches with the same ambient input value.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["branches"],
    properties: {
      value: {},
      branches: { type: "array", minItems: 1, items: branchSchema },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "status", "output", "error"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            status: { type: "string", enum: ["success", "failed"] },
            output: {},
            error: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  async run(input, context) {
    const results = await Promise.all(input.branches.map(async (branch) => {
      try {
        const branchInput = injectFanoutValue(branch.input, input.value);
        const output = await context.runAction(branch.type, branchInput, branch.config);
        return { id: branch.id, type: branch.type, status: "success" as const, output, error: null };
      } catch (error) {
        return {
          id: branch.id,
          type: branch.type,
          status: "failed" as const,
          output: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));
    return { results };
  },
};

export const faninAction: ActionDefinition<FaninInput, FaninOutput> = {
  type: "control.fanin",
  description: "Merge fanout results using a configured strategy.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: { type: "array" },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["strategy", "output", "count"],
    properties: {
      strategy: { type: "string", enum: ["merge", "first_success"] },
      output: {},
      count: { type: "number" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      strategy: { type: "string", enum: ["merge", "first_success"], nullable: true },
    },
  },
  async run(input, _context, config) {
    const strategy = (config?.strategy === "first_success" ? "first_success" : "merge") as "merge" | "first_success";
    if (strategy === "first_success") {
      const first = input.items.find((item) => isSuccessResult(item));
      return { strategy, output: first ?? null, count: first ? 1 : 0 };
    }
    return { strategy, output: mergeItems(input.items), count: input.items.length };
  },
};

function injectFanoutValue(input: unknown, value: unknown): unknown {
  if (input === "$input") return value;
  if (typeof input === "string") return input.replaceAll("{{input}}", stringify(value));
  if (Array.isArray(input)) return input.map((item) => injectFanoutValue(item, value));
  if (input && typeof input === "object") {
    return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, injectFanoutValue(item, value)]));
  }
  return input;
}

function mergeItems(items: unknown[]): unknown {
  const outputs = items.map((item) => isFanoutResult(item) ? item.output : item);
  if (outputs.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    return Object.assign({}, ...(outputs as JsonObject[]));
  }
  return outputs;
}

function isFanoutResult(value: unknown): value is { status: string; output: unknown } {
  return Boolean(value && typeof value === "object" && "status" in value && "output" in value);
}

function isSuccessResult(value: unknown): boolean {
  return isFanoutResult(value) && value.status === "success";
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

