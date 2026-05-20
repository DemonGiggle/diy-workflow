#!/usr/bin/env node
import { Command } from "commander";
import { createDefaultRegistry } from "./actions/index.js";
import { WorkflowExecutor } from "./executor.js";
import { loadWorkflow } from "./loader.js";
import { formatRunLogEvent, shouldPrintLogEvent } from "./logs.js";
import { createWorkflowServer } from "./server.js";
import { TraceStore } from "./trace.js";
import type { LogLevel } from "./types.js";
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
  .option("--log-level <level>", "minimum log level to print: debug, info, warn, error", "info")
  .option("--quiet", "suppress live log output and keep only the final summary")
  .option("--verbose", "show debug-level live logs")
  .action(async (workflowPath: string, options: { logLevel?: string; quiet?: boolean; verbose?: boolean }) => {
    await runCli(async () => {
      const logLevel = resolveCliLogLevel(options);
      const registry = createDefaultRegistry();
      const workflow = await loadWorkflow(workflowPath);
      const trace = await new WorkflowExecutor().execute({
        workflowPath,
        workflow,
        registry,
        logWriter: async (event) => {
          if (logLevel === null || !shouldPrintLogEvent(event, logLevel)) return;
          await new Promise<void>((resolvePromise, reject) => {
            process.stdout.write(formatRunLogEvent(event), (error) => {
              if (error) reject(error);
              else resolvePromise();
            });
          });
        },
      });
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

program
  .command("serve")
  .description("Serve the visual editor and workflow run API")
  .option("-p, --port <port>", "HTTP port", "4173")
  .option("--host <host>", "HTTP host", "127.0.0.1")
  .action(async (options: { port: string; host: string }) => {
    await runCli(async () => {
      const port = Number(options.port);
      if (!Number.isInteger(port) || port <= 0) throw new Error(`Invalid port: ${options.port}`);

      const server = createWorkflowServer();
      server.listen(port, options.host, () => {
        console.log(`diy-workflow editor: http://${options.host}:${port}/`);
      });
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

function resolveCliLogLevel(options: { logLevel?: string; quiet?: boolean; verbose?: boolean }): LogLevel | null {
  if (options.quiet) return null;
  if (options.verbose) return "debug";
  const value = options.logLevel ?? "info";
  if (value === "debug" || value === "info" || value === "warn" || value === "error") return value;
  throw new Error(`Invalid log level: ${value}`);
}
