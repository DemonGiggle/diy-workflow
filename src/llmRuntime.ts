import type { JsonObject, LlmExecutionMetadata, LlmRuntimeLike, StepTraceMetadata, WorkflowDocument } from "./types.js";
import { resolveLlmProviderSelection, resolveWorkflowProviderCatalog, type LlmActionType } from "./providers.js";
import { readMockConfig } from "./actions/mock.js";

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

interface ImageArtifact {
  path: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
}

interface VisionAnalyzeInput {
  image: ImageArtifact;
  prompt?: string;
}

interface OcrInput {
  image: ImageArtifact;
}

interface TextOutput {
  text: string;
}

interface LlmProviderAdapter {
  run<TOutput>(type: LlmActionType, input: unknown, config: JsonObject | undefined, metadata: LlmExecutionMetadata): Promise<TOutput>;
}

export function createLlmRuntime(options: {
  workflow: Pick<WorkflowDocument, "providerCatalog">;
  setTraceMetadata: (metadata: StepTraceMetadata) => void;
}): LlmRuntimeLike {
  return {
    async run<TOutput>(type: string, input: unknown, config?: JsonObject): Promise<TOutput> {
      if (!isRuntimeActionType(type)) throw new Error(`Unsupported LLM action type: ${type}`);

      const catalog = resolveWorkflowProviderCatalog(options.workflow);
      const selection = resolveLlmProviderSelection(catalog, type, config);
      const metadata: LlmExecutionMetadata = {
        providerId: selection.providerId,
        modelId: selection.modelId,
        providerKind: selection.provider.kind,
        source: selection.source,
        operation: type,
      };
      options.setTraceMetadata({ llm: metadata });

      const adapter = selection.provider.kind === "mock"
        ? mockAdapter
        : new PlaceholderProviderAdapter(selection.provider.id, selection.provider.kind, selection.provider.apiKeyRef);
      return adapter.run<TOutput>(type, input, config, metadata);
    },
  };
}

const mockAdapter: LlmProviderAdapter = {
  async run<TOutput>(type: LlmActionType, input: unknown, config: JsonObject | undefined): Promise<TOutput> {
    switch (type) {
      case "llm.prompt":
        return runPrompt(input as PromptInput, config) as TOutput;
      case "llm.summarize":
        return runSummarize(input as SummarizeInput, config) as TOutput;
      case "llm.vision_analyze":
        return runVisionAnalyze(input as VisionAnalyzeInput, config) as TOutput;
      case "llm.ocr":
        return runOcr(input as OcrInput, config) as TOutput;
    }
  },
};

class PlaceholderProviderAdapter implements LlmProviderAdapter {
  constructor(
    private readonly providerId: string,
    private readonly providerKind: string,
    private readonly apiKeyRef: string | undefined,
  ) {}

  async run<TOutput>(_type: LlmActionType, _input: unknown, config: JsonObject | undefined): Promise<TOutput> {
    if (hasActionLevelMock(config)) {
      return mockAdapter.run<TOutput>(_type, _input, config, {
        providerId: this.providerId,
        modelId: "",
        providerKind: this.providerKind as never,
        source: "node",
        operation: _type,
      });
    }

    const envName = readEnvReference(this.apiKeyRef);
    if (!envName) {
      throw new Error(`Provider ${this.providerId} requires apiKeyRef before runtime execution`);
    }
    if (!process.env[envName]) {
      throw new Error(`Missing credential for provider ${this.providerId}: env ${envName} is not set`);
    }
    throw new Error(`Provider kind ${this.providerKind} is not implemented yet for ${this.providerId}`);
  }
}

function isRuntimeActionType(type: string): type is LlmActionType {
  return type === "llm.prompt" || type === "llm.summarize" || type === "llm.vision_analyze" || type === "llm.ocr";
}

function runPrompt(input: PromptInput, config?: JsonObject): PromptOutput {
  const mock = readMockConfig(config);
  const mockResponse = typeof mock?.response === "string"
    ? mock.response
    : typeof config?.mockResponse === "string"
      ? config.mockResponse
      : undefined;
  const text = mockResponse ?? renderPrompt(input.prompt, input.variables ?? {});
  return { text };
}

function runSummarize(input: SummarizeInput, config?: JsonObject): SummarizeOutput {
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
}

function runVisionAnalyze(input: VisionAnalyzeInput, config?: JsonObject): TextOutput {
  const mock = readMockConfig(config);
  return { text: typeof mock?.response === "string" ? mock.response : renderVisionPreview(input.image, input.prompt) };
}

function runOcr(input: OcrInput, config?: JsonObject): TextOutput {
  const mock = readMockConfig(config);
  return { text: typeof mock?.response === "string" ? mock.response : renderOcrPreview(input.image) };
}

function hasActionLevelMock(config: JsonObject | undefined): boolean {
  return Boolean(readMockConfig(config) || typeof config?.mockResponse === "string");
}

function readEnvReference(apiKeyRef: string | undefined): string | undefined {
  if (!apiKeyRef) return undefined;
  return apiKeyRef.startsWith("env:") ? apiKeyRef.slice(4) : apiKeyRef;
}

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

function renderVisionPreview(image: ImageArtifact, prompt?: string): string {
  const summary = [
    `Vision preview for ${image.path}`,
    `(${image.mimeType}, ${image.bytes} bytes${image.width && image.height ? `, ${image.width}x${image.height}` : ""})`,
  ].join(" ");
  return prompt ? `${summary} Prompt: ${prompt}` : summary;
}

function renderOcrPreview(image: ImageArtifact): string {
  return `OCR preview for ${image.path} (${image.mimeType}, ${image.bytes} bytes)`;
}
