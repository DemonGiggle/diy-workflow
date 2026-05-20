import test from "node:test";
import assert from "node:assert/strict";
import { createTopbarLayout } from "./topbar.js";

test("topbar layout keeps file actions in the workflow menu and run actions visible", () => {
  const layout = createTopbarLayout({ saveUsesFileSystemApi: true, hasRuns: true });

  assert.deepEqual(layout.workflowMenuActions.map((action) => action.id), ["open-workflow", "save-workflow", "copy-yaml"]);
  assert.equal(layout.workflowMenuActions[1]?.labelKey, "yaml.saveAction");
  assert.deepEqual(layout.runActions.map((action) => action.id), ["validate-workflow", "run-workflow"]);
  assert.equal(layout.runActions[1]?.emphasis, "primary");
  assert.deepEqual(layout.moreMenuActions.map((action) => action.id), ["show-latest-run", "refresh-runs"]);
});

test("topbar layout falls back to download wording when file-system save is unavailable", () => {
  const layout = createTopbarLayout({ saveUsesFileSystemApi: false, hasRuns: false });

  assert.equal(layout.workflowMenuActions[1]?.labelKey, "yaml.downloadAction");
  assert.deepEqual(layout.moreMenuActions.map((action) => action.id), ["refresh-runs"]);
});
