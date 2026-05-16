import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createWorkflowServer } from "../../src/server.js";
import type { RunTrace, WorkflowDocument } from "../../src/types.js";

test("workflow server runs workflows and exposes saved traces", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-server-"));
  const webRoot = join(dir, "web-dist");
  const traceRoot = join(dir, "runs");
  await mkdir(webRoot, { recursive: true });
  await writeFile(join(webRoot, "index.html"), "<main>diy-workflow</main>", "utf8");

  const server = createWorkflowServer({ cwd: dir, webRoot, traceRoot });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const workflow: WorkflowDocument = {
      name: "server-test",
      steps: [
        {
          id: "prompt",
          type: "llm.prompt",
          input: { prompt: "hello" },
          config: { mockResponse: "world" },
        },
      ],
    };

    const runResponse = await fetch(`${baseUrl}/api/workflows/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow }),
    });
    assert.equal(runResponse.ok, true);
    const trace = await runResponse.json() as RunTrace;
    assert.equal(trace.status, "success");
    assert.equal(trace.steps[0]?.output && (trace.steps[0].output as Record<string, unknown>).text, "world");

    const listResponse = await fetch(`${baseUrl}/api/runs`);
    assert.deepEqual(await listResponse.json(), { runs: [trace.runId] });

    const showResponse = await fetch(`${baseUrl}/api/runs/${trace.runId}`);
    const saved = await showResponse.json() as RunTrace;
    assert.equal(saved.runId, trace.runId);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("workflow server validates workflow requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-server-"));
  const webRoot = join(dir, "web-dist");
  await mkdir(webRoot, { recursive: true });
  await writeFile(join(webRoot, "index.html"), "<main>diy-workflow</main>", "utf8");

  const server = createWorkflowServer({ cwd: dir, webRoot, traceRoot: join(dir, "runs") });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const response = await fetch(`${baseUrl}/api/workflows/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow: { steps: [{ id: "bad", type: "missing.action", input: {} }] } }),
    });
    assert.equal(response.status, 422);
    const result = await response.json() as { ok: boolean; issues: Array<{ message: string }> };
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.message.includes("Unknown action type")));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("workflow server serves built UI from package root when cwd differs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-server-cwd-"));
  await mkdir(resolve("dist-test", "web-dist"), { recursive: true });
  await writeFile(resolve("dist-test", "web-dist", "index.html"), "<main>diy-workflow</main>", "utf8");

  const server = createWorkflowServer({ cwd: dir });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const response = await fetch(baseUrl);
    assert.equal(response.ok, true);
    assert.match(await response.text(), /diy-workflow/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
