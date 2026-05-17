import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TraceStore } from "./trace.js";

test("TraceStore reserves unique run ids for concurrent callers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diy-workflow-trace-"));
  try {
    const store = new TraceStore(dir);
    const runIds = await Promise.all([store.nextRunId(), store.nextRunId(), store.nextRunId()]);
    assert.equal(new Set(runIds).size, runIds.length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
