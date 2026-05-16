import type { ActionDefinition, JsonObject } from "../types.js";
import { readMockConfig } from "./mock.js";

interface PromptInput {
  prompt: string;
  variables?: JsonObject;
}

interface PromptOutput {
  text: string;
  provider: "mock";
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
    required: ["text", "provider"],
    properties: {
      text: { type: "string" },
      provider: { type: "string", const: "mock" },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
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
  async run(input, _context, config) {
    const mock = readMockConfig(config);
    const mockResponse = typeof mock?.response === "string"
      ? mock.response
      : typeof config?.mockResponse === "string"
        ? config.mockResponse
        : undefined;
    const text = mockResponse ?? renderPrompt(input.prompt, input.variables ?? {});
    return { text, provider: "mock" };
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
  async run(input, _context, config) {
    const mock = readMockConfig(config);
    if (mock) {
      const summary = typeof mock.summary === "string" ? mock.summary : "";
      return {
        summary,
        sentenceCount: typeof mock.sentenceCount === "number" ? mock.sentenceCount : splitSentences(summary).length,
      };
    }

    const maxSentences = typeof config?.maxSentences === "number" ? config.maxSentences : 3;
    const maxChars = typeof config?.maxChars === "number" ? config.maxChars : undefined;
    const sentences = splitSentences(input.text);
    let summary = sentences.slice(0, maxSentences).join(" ");
    if (maxChars && summary.length > maxChars) summary = `${summary.slice(0, maxChars - 1)}…`;
    return { summary, sentenceCount: sentences.length };
  },
};

function renderPrompt(prompt: string, variables: JsonObject): string {
  return prompt.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_all, key: string) => {
    const value = key.split(".").reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as JsonObject)[part];
    }, variables);
    return value === undefined || value === null ? "" : String(value);
  });
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}
