import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const cliPath = resolve("dist/cli.js");

test("CLI validates, runs, lists, and shows a workflow trace", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-cli-"));
  try {
    await writeFile(join(dir, "input.txt"), "One. Two. Three.", "utf8");
    const workflowPath = join(dir, "workflow.yaml");
    await writeFile(workflowPath, [
      "name: cli-test",
      "steps:",
      "  - id: read",
      "    type: io.read_file",
      "    input:",
      "      path: input.txt",
      "  - id: summarize",
      "    type: llm.summarize",
      "    input:",
      "      text: \"{{steps.read.output.content}}\"",
      "    config:",
      "      maxSentences: 2",
      "",
    ].join("\n"), "utf8");

    const validate = await runCli(["validate", workflowPath], dir);
    assert.equal(validate.code, 0);
    assert.match(validate.stdout, /Workflow is valid/);

    const run = await runCli(["run", workflowPath], dir);
    assert.equal(run.code, 0);
    assert.match(run.stdout, /SUCCESS run_0001/);
    assert.match(run.stdout, /Trace: runs\/run_0001\/trace\.json/);

    const list = await runCli(["runs", "list"], dir);
    assert.equal(list.stdout.trim(), "run_0001");

    const show = await runCli(["runs", "show", "run_0001"], dir);
    assert.equal(show.code, 0);
    const trace = JSON.parse(show.stdout) as { status: string; steps: Array<{ id: string; output: unknown }> };
    assert.equal(trace.status, "success");
    assert.deepEqual(trace.steps.map((step) => step.id), ["read", "summarize"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI validate exits non-zero for invalid workflows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-cli-"));
  try {
    const workflowPath = join(dir, "invalid.yaml");
    await writeFile(workflowPath, "steps:\n  - id: bad\n    type: missing.action\n    input: {}\n", "utf8");

    const result = await runCli(["validate", workflowPath], dir);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown action type/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI serve launches a real HTTP server for static UI and workflow API", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-serve-"));
  const port = await freePort();
  const child = spawn(process.execPath, [cliPath, "serve", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: dir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForOutput(child, /diy-workflow editor:/);
    const baseUrl = `http://127.0.0.1:${port}`;

    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /diy-workflow/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.deepEqual(await health.json(), { ok: true });

    const run = await fetch(`${baseUrl}/api/workflows/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflow: {
          name: "serve-test",
          steps: [
            {
              id: "prompt",
              type: "llm.prompt",
              input: { prompt: "hello" },
              config: { mock: { enabled: true, response: "world" } },
            },
          ],
        },
      }),
    });
    assert.equal(run.status, 200);
    const trace = await run.json() as { runId: string; status: string; steps: Array<{ output: unknown }> };
    assert.equal(trace.status, "success");
    assert.deepEqual(trace.steps[0]?.output, { text: "world" });

    const list = await fetch(`${baseUrl}/api/runs`);
    assert.deepEqual(await list.json(), { runs: [trace.runId] });
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child);
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI runs image workflows with connected image artifacts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-image-cli-"));
  try {
    await writeFile(join(dir, "input.png"), pngFixture());
    const workflowPath = join(dir, "workflow.yaml");
    await writeFile(workflowPath, [
      "name: image-cli-test",
      "steps:",
      "  - id: read",
      "    type: io.read_image",
      "    input:",
      "      path: input.png",
      "  - id: ocr",
      "    type: llm.ocr",
      "    input:",
      "      image: \"{{steps.read.output.image}}\"",
      "    config:",
      "      mock:",
      "        enabled: true",
      "        response: \"Detected image text\"",
      "  - id: summarize",
      "    type: llm.summarize",
      "    input:",
      "      text: \"{{steps.ocr.output.text}}\"",
      "    config:",
      "      mock:",
      "        enabled: true",
      "        summary: \"Summary from OCR\"",
      "        sentenceCount: 1",
      "",
    ].join("\n"), "utf8");

    const run = await runCli(["run", workflowPath], dir);
    assert.equal(run.code, 0);
    assert.match(run.stdout, /SUCCESS run_0001/);

    const show = await runCli(["runs", "show", "run_0001"], dir);
    const trace = JSON.parse(show.stdout) as {
      status: string;
      steps: Array<{ id: string; type: string; output: { image?: { mimeType?: string }; text?: string; summary?: string } }>;
    };
    assert.equal(trace.status, "success");
    assert.equal(trace.steps[0]?.type, "io.read_image");
    assert.equal(trace.steps[0]?.output.image?.mimeType, "image/png");
    assert.equal(trace.steps[1]?.output.text, "Detected image text");
    assert.equal(trace.steps[2]?.output.summary, "Summary from OCR");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI prints stdout action output during workflow runs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-stdout-cli-"));
  try {
    const workflowPath = join(dir, "workflow.yaml");
    await writeFile(workflowPath, [
      "name: stdout-cli-test",
      "steps:",
      "  - id: prompt",
      "    type: llm.prompt",
      "    input:",
      "      prompt: hello",
      "    config:",
      "      mock:",
      "        enabled: true",
      "        response: world",
      "  - id: emit",
      "    type: io.write_stdout",
      "    input:",
      "      label: result",
      "      content: \"{{steps.prompt.output.text}}\"",
      "",
    ].join("\n"), "utf8");

    const run = await runCli(["run", workflowPath], dir);
    assert.equal(run.code, 0);
    assert.match(run.stdout, /^result: world\r?\nSUCCESS run_0001\r?\nTrace: runs\/run_0001\/trace\.json\r?\n?$/);

    const show = await runCli(["runs", "show", "run_0001"], dir);
    assert.equal(show.code, 0);
    const trace = JSON.parse(show.stdout) as {
      logs?: Array<{ index: number; timestamp: string; level: string; stepId: string; category?: string; message?: string; label?: string; newline?: boolean; bytes?: number }>;
      steps: Array<{ id: string; type: string; output: { content?: string; label?: string; newline?: boolean; bytes?: number } }>;
    };
    assert.equal(trace.steps[1]?.id, "emit");
    assert.equal(trace.steps[1]?.type, "io.write_stdout");
    assert.deepEqual(trace.steps[1]?.output, {
      content: "world",
      label: "result",
      newline: true,
      bytes: Buffer.byteLength("result: world\n", "utf8"),
    });
    assert.deepEqual(
      trace.logs?.filter((entry) => entry.category === "stdout"),
      [
        {
          stepId: "emit",
          category: "stdout",
          message: "world",
          label: "result",
          newline: true,
          bytes: Buffer.byteLength("result: world\n", "utf8"),
        },
      ].map((entry) => ({
        ...entry,
        index: trace.logs?.find((log) => log.category === "stdout" && log.stepId === entry.stepId)?.index,
        level: "info",
        timestamp: trace.logs?.find((log) => log.category === "stdout" && log.stepId === entry.stepId)?.timestamp,
      })),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function runCli(args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

type ServerProcess = ChildProcessByStdio<null, Readable, Readable>;

function waitForOutput(child: ServerProcess, pattern: RegExp): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}. Output: ${output}`)), 5000);
    const onData = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        clearTimeout(timeout);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolvePromise();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!pattern.test(output)) reject(new Error(`Process exited with ${code} before ${pattern}. Output: ${output}`));
    });
  });
}

function waitForExit(child: ServerProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return Promise.resolve();
  return new Promise((resolvePromise) => child.once("exit", () => resolvePromise()));
}

function freePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePromise(port));
    });
    server.on("error", reject);
  });
}

function pngFixture(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2sZl8AAAAASUVORK5CYII=",
    "base64",
  );
}
