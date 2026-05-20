import type { JSONSchemaType } from "ajv";

export type JsonObject = Record<string, unknown>;

export type LlmProviderKind = "openai-compatible" | "anthropic" | "gemini" | "mock" | "custom";

export interface LlmModelCapabilities {
  text?: boolean;
  vision?: boolean;
  structuredOutput?: boolean;
  tools?: boolean;
}

export interface LlmModelDefinition {
  id: string;
  label: string;
  capabilities?: LlmModelCapabilities;
  contextWindow?: number;
  enabled?: boolean;
}

export interface LlmProviderDefinition {
  id: string;
  label: string;
  kind: LlmProviderKind;
  baseUrl?: string;
  apiKeyRef?: string;
  models: LlmModelDefinition[];
  enabled?: boolean;
}

export interface ProviderCatalog {
  providers: LlmProviderDefinition[];
  defaultProviderId?: string;
  defaultModelId?: string;
}

export interface WorkflowDocument {
  name?: string;
  providerCatalog?: ProviderCatalog;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: string;
  input: unknown;
  config?: JsonObject;
}

export interface LlmExecutionMetadata {
  providerId: string;
  modelId: string;
  providerKind: LlmProviderKind;
  source: "default" | "node";
  operation: string;
}

export interface StdoutEmission {
  content: string;
  label?: string;
  newline: boolean;
}

export interface StdoutTraceOutput extends StdoutEmission {
  bytes: number;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ActionLogEvent {
  level: LogLevel;
  message: string;
  label?: string;
  category?: string;
  data?: unknown;
  newline?: boolean;
  bytes?: number;
}

export interface RunLogEvent {
  index: number;
  timestamp: string;
  level: LogLevel;
  stepId: string;
  message: string;
  label?: string;
  category?: string;
  data?: unknown;
  newline?: boolean;
  bytes?: number;
}

export interface StepTraceMetadata {
  llm?: LlmExecutionMetadata;
}

export interface LlmRuntimeLike {
  run<TOutput = unknown>(type: string, input: unknown, config?: JsonObject): Promise<TOutput>;
}

export interface ActionContext {
  runId: string;
  stepId: string;
  cwd: string;
  registry: ActionRegistryLike;
  llm: LlmRuntimeLike;
  setTraceMetadata(metadata: StepTraceMetadata): void;
  emitLog(event: ActionLogEvent): Promise<void>;
  emitStdout(output: StdoutEmission): Promise<void>;
  runAction(type: string, input: unknown, config?: JsonObject): Promise<unknown>;
}

export interface ActionRegistryLike {
  get(type: string): ActionDefinition | undefined;
  list(): ActionDefinition[];
}

export interface ActionDefinition<TInput = unknown, TOutput = unknown> {
  type: string;
  description: string;
  inputSchema: JSONSchemaType<TInput> | JsonObject;
  outputSchema: JSONSchemaType<TOutput> | JsonObject;
  configSchema?: JSONSchemaType<JsonObject> | JsonObject;
  run(input: TInput, context: ActionContext, config?: JsonObject): Promise<TOutput>;
  sanitizeTraceInput?(input: TInput): unknown;
  sanitizeTraceOutput?(output: TOutput): unknown;
}

export type StepStatus = "success" | "failed";

export interface StepTrace {
  id: string;
  type: string;
  input: unknown;
  output: unknown;
  metadata?: StepTraceMetadata;
  status: StepStatus;
  error: string | null;
  metrics: {
    startedAt: string;
    endedAt: string;
    durationMs: number;
  };
}

export interface RunTrace {
  runId: string;
  workflow: {
    name?: string;
    path: string;
  };
  status: StepStatus;
  startedAt: string;
  endedAt: string;
  logs?: RunLogEvent[];
  steps: StepTrace[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
