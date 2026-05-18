import type { ActionDefinition, JsonObject } from "../types.js";

const llmSelectionConfigSchema = {
  providerId: { type: "string", minLength: 1, nullable: true },
  modelId: { type: "string", minLength: 1, nullable: true },
};

interface PromptInput {
  prompt: string;
  variables?: JsonObject;
}

interface PromptOutput {
  text: string;
}

interface SummarizeInput {
  text: string;
}

interface SummarizeOutput {
  summary: string;
  sentenceCount: number;
}

export const promptAction: ActionDefinition<PromptInput, PromptOutput> = {
  type: "llm.prompt",
  description: "Run a prompt through the configured LLM provider. MVP uses a deterministic mock provider.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
      prompt: { type: "string" },
      variables: { type: "object", nullable: true, additionalProperties: true },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...llmSelectionConfigSchema,
      mockResponse: { type: "string", nullable: true },
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          response: { type: "string", nullable: true },
        },
      },
    },
  },
  async run(input, context, config) {
    return await context.llm.run<PromptOutput>("llm.prompt", input, config);
  },
};

export const summarizeAction: ActionDefinition<SummarizeInput, SummarizeOutput> = {
  type: "llm.summarize",
  description: "Summarize text. MVP uses deterministic extractive summarization.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: {
      text: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "sentenceCount"],
    properties: {
      summary: { type: "string" },
      sentenceCount: { type: "number" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ...llmSelectionConfigSchema,
      maxSentences: { type: "number", minimum: 1, nullable: true },
      maxChars: { type: "number", minimum: 1, nullable: true },
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          summary: { type: "string", nullable: true },
          sentenceCount: { type: "number", minimum: 0, nullable: true },
        },
      },
    },
  },
  async run(input, context, config) {
    return await context.llm.run<SummarizeOutput>("llm.summarize", input, config);
  },
};
