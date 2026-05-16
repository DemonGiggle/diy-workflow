import type { JSONSchemaType } from "ajv";

export type JsonObject = Record<string, unknown>;

export interface WorkflowDocument {
  name?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: string;
  input: unknown;
  config?: JsonObject;
}

export interface ActionContext {
  runId: string;
  stepId: string;
  cwd: string;
  registry: ActionRegistryLike;
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
}

export type StepStatus = "success" | "failed";

export interface StepTrace {
  id: string;
  type: string;
  input: unknown;
  output: unknown;
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

