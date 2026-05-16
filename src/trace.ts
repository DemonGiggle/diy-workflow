import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunTrace } from "./types.js";

export class TraceStore {
  constructor(private readonly root = "runs") {}

  async nextRunId(): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const max = entries
      .filter((entry) => entry.isDirectory() && /^run_\d{4}$/.test(entry.name))
      .map((entry) => Number(entry.name.slice(4)))
      .reduce((highest, value) => Math.max(highest, value), 0);
    return `run_${String(max + 1).padStart(4, "0")}`;
  }

  async save(trace: RunTrace): Promise<string> {
    const dir = join(this.root, trace.runId);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "trace.json");
    await writeFile(path, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
    return path;
  }

  async list(): Promise<string[]> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && /^run_\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  async read(runId: string): Promise<RunTrace> {
    const raw = await readFile(join(this.root, runId, "trace.json"), "utf8");
    return JSON.parse(raw) as RunTrace;
  }
}

