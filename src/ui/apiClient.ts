import type { RunTrace, ValidationResult, WorkflowDocument } from "../types.js";

export async function validateWorkflow(workflow: WorkflowDocument): Promise<ValidationResult> {
  return requestJson<ValidationResult>("/api/workflows/validate", {
    method: "POST",
    body: JSON.stringify({ workflow }),
  });
}

export async function runWorkflow(workflow: WorkflowDocument): Promise<RunTrace> {
  return requestJson<RunTrace>("/api/workflows/run", {
    method: "POST",
    body: JSON.stringify({ workflow }),
  });
}

export async function listRuns(): Promise<string[]> {
  const result = await requestJson<{ runs: string[] }>("/api/runs");
  return result.runs;
}

export async function showRun(runId: string): Promise<RunTrace> {
  return requestJson<RunTrace>(`/api/runs/${encodeURIComponent(runId)}`);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.status}`);
  return data as T;
}

