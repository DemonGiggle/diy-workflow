import { watch } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActionDefinition } from "../types.js";
import { readMockConfig } from "./mock.js";

interface WatchDirInput {
  path: string;
  debounceMs?: number;
}

interface WatchDirOutput {
  directory: string;
  paths: string[];
}

export const watchDirAction: ActionDefinition<WatchDirInput, WatchDirOutput> = {
  type: "trigger.watch_dir",
  description: "Wait for the first batch of file changes in a directory and emit changed file paths.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string", minLength: 1 },
      debounceMs: { type: "number", minimum: 0, nullable: true },
    },
  },
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          directory: { type: "string", nullable: true },
          paths: {
            type: "array",
            nullable: true,
            items: { type: "string" },
          },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["directory", "paths"],
    properties: {
      directory: { type: "string" },
      paths: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  async run(input, context, config) {
    const absoluteDirectory = resolve(context.cwd, input.path);
    const mock = readMockConfig(config);
    if (mock) {
      return {
        directory: typeof mock.directory === "string" ? mock.directory : absoluteDirectory,
        paths: Array.isArray(mock.paths) ? mock.paths.filter((value): value is string => typeof value === "string") : [],
      };
    }

    const info = await stat(absoluteDirectory);
    if (!info.isDirectory()) {
      throw new Error(`trigger.watch_dir requires a directory path: ${absoluteDirectory}`);
    }

    const paths = await waitForDirectoryChanges(absoluteDirectory, input.debounceMs ?? 50);
    return {
      directory: absoluteDirectory,
      paths,
    };
  },
};

async function waitForDirectoryChanges(directory: string, debounceMs: number): Promise<string[]> {
  return await new Promise<string[]>((resolvePromise, rejectPromise) => {
    let settled = false;
    let debounceTimer: NodeJS.Timeout | null = null;
    const changedPaths = new Set<string>();

    const watcher = watch(directory, (_eventType, filename) => {
      changedPaths.add(filename ? resolve(directory, filename.toString()) : directory);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(finish, debounceMs);
    });

    watcher.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    });

    function finish(): void {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise([...changedPaths].sort());
    }

    function cleanup(): void {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      watcher.close();
    }
  });
}
