import { Ajv } from "ajv";
import { dirname, resolve } from "node:path";
import type { ActionContext, JsonObject, RunTrace, StepTrace, WorkflowDocument } from "./types.js";
import type { ActionRegistry } from "./registry.js";
import { resolveReferences, type StepOutputRecord } from "./references.js";
import { TraceStore } from "./trace.js";
import { WorkflowValidator } from "./validator.js";

export interface ExecuteOptions {
  workflowPath: string;
  workflow: WorkflowDocument;
  registry: ActionRegistry;
  traceStore?: TraceStore;
}

export class WorkflowExecutor {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });

  async execute(options: ExecuteOptions): Promise<RunTrace> {
    const traceStore = options.traceStore ?? new TraceStore();
    const validator = new WorkflowValidator(options.registry);
    const validation = validator.validate(options.workflow);
    if (!validation.ok) {
      throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }

    const runId = await traceStore.nextRunId();
    const startedAt = new Date().toISOString();
    const stepOutputs = new Map<string, StepOutputRecord>();
    const steps: StepTrace[] = [];
    const cwd = dirname(resolve(options.workflowPath));

    let status: "success" | "failed" = "success";
    for (const step of options.workflow.steps) {
      const action = options.registry.get(step.type);
      if (!action) throw new Error(`Unknown action type after validation: ${step.type}`);

      const stepStarted = Date.now();
      const started = new Date(stepStarted).toISOString();
      let resolvedInput: unknown = null;
      let output: unknown = null;
      let error: string | null = null;
      let stepStatus: "success" | "failed" = "success";

      try {
        resolvedInput = resolveReferences(step.input, stepOutputs);
        this.assertSchema(action.inputSchema, resolvedInput, `Resolved input for ${step.id}`);

        const context: ActionContext = {
          runId,
          stepId: step.id,
          cwd,
          registry: options.registry,
          runAction: async (type: string, input: unknown, config?: JsonObject) => {
            const nested = options.registry.get(type);
            if (!nested) throw new Error(`Unknown nested action type: ${type}`);
            this.assertSchema(nested.inputSchema, input, `Nested input for ${type}`);
            const nestedOutput = await nested.run(input as never, context, config);
            this.assertSchema(nested.outputSchema, nestedOutput, `Nested output for ${type}`);
            return nestedOutput;
          },
        };

        output = await action.run(resolvedInput as never, context, step.config);
        this.assertSchema(action.outputSchema, output, `Output for ${step.id}`);
        stepOutputs.set(step.id, { output });
      } catch (caught) {
        stepStatus = "failed";
        status = "failed";
        error = caught instanceof Error ? caught.message : String(caught);
      }

      const stepEnded = Date.now();
      steps.push({
        id: step.id,
        type: step.type,
        input: resolvedInput,
        output,
        status: stepStatus,
        error,
        metrics: { startedAt: started, endedAt: new Date(stepEnded).toISOString(), durationMs: stepEnded - stepStarted },
      });

      if (stepStatus === "failed") break;
    }

    const trace: RunTrace = {
      runId,
      workflow: { name: options.workflow.name, path: resolve(options.workflowPath) },
      status,
      startedAt,
      endedAt: new Date().toISOString(),
      steps,
    };
    await traceStore.save(trace);
    return trace;
  }

  private assertSchema(schema: object, value: unknown, label: string): void {
    const validate = this.ajv.compile(schema);
    if (!validate(value)) {
      const details = (validate.errors ?? []).map((error: { instancePath?: string; message?: string }) => `${error.instancePath || "/"} ${error.message}`).join("; ");
      throw new Error(`${label} failed schema validation: ${details}`);
    }
  }
}
