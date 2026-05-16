#!/usr/bin/env node
import { Command } from "commander";
import { createDefaultRegistry } from "./actions/index.js";
import { WorkflowExecutor } from "./executor.js";
import { loadWorkflow } from "./loader.js";
import { TraceStore } from "./trace.js";
import { WorkflowValidator } from "./validator.js";

const program = new Command();

program
  .name("diy-workflow")
  .description("CLI-first typed workflow experiment engine")
  .version("0.1.0");

program
  .command("validate")
  .argument("<workflow>", "workflow YAML file")
  .description("Validate a workflow without executing it")
  .action(async (workflowPath: string) => {
    await runCli(async () => {
      const registry = createDefaultRegistry();
      const workflow = await loadWorkflow(workflowPath);
      const result = new WorkflowValidator(registry).validate(workflow);
      if (!result.ok) {
        for (const issue of result.issues) console.error(`${issue.path}: ${issue.message}`);
        process.exitCode = 1;
        return;
      }
      console.log("Workflow is valid");
    });
  });

program
  .command("run")
  .argument("<workflow>", "workflow YAML file")
  .description("Execute a workflow and save a trace")
  .action(async (workflowPath: string) => {
    await runCli(async () => {
      const registry = createDefaultRegistry();
      const workflow = await loadWorkflow(workflowPath);
      const trace = await new WorkflowExecutor().execute({ workflowPath, workflow, registry });
      console.log(`${trace.status.toUpperCase()} ${trace.runId}`);
      console.log(`Trace: runs/${trace.runId}/trace.json`);
      if (trace.status !== "success") process.exitCode = 1;
    });
  });

const runs = program.command("runs").description("Inspect saved workflow runs");

runs
  .command("list")
  .description("List saved run ids")
  .action(async () => {
    await runCli(async () => {
      const ids = await new TraceStore().list();
      for (const id of ids) console.log(id);
    });
  });

runs
  .command("show")
  .argument("<run_id>", "run id, for example run_0001")
  .description("Show a saved run trace")
  .action(async (runId: string) => {
    await runCli(async () => {
      const trace = await new TraceStore().read(runId);
      console.log(JSON.stringify(trace, null, 2));
    });
  });

await program.parseAsync(process.argv);

async function runCli(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

