import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { WorkflowDocument } from "./types.js";

export async function loadWorkflow(path: string): Promise<WorkflowDocument> {
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Workflow YAML must be an object");
  }
  return parsed as WorkflowDocument;
}

