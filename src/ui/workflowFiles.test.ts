import test from "node:test";
import assert from "node:assert/strict";
import { formatValidationIssues, parseWorkflowYaml, suggestWorkflowFileName } from "./workflowFiles.js";

test("workflow file helpers parse valid YAML workflows", () => {
  const workflow = parseWorkflowYaml(`
name: review-flow
steps:
  - id: read
    type: io.read_file
    input:
      path: input.txt
`);

  assert.equal(workflow.name, "review-flow");
  assert.deepEqual(workflow.steps[0], {
    id: "read",
    type: "io.read_file",
    input: {
      path: "input.txt",
    },
  });
});

test("workflow file helpers reject malformed YAML documents", () => {
  assert.throws(() => parseWorkflowYaml("steps:\n  - id: bad\n    type"), /(Implicit map keys|line 3)/);
});

test("workflow file helpers reject non-workflow YAML values", () => {
  assert.throws(() => parseWorkflowYaml("- just\n- a\n- list\n"), /steps array/);
});

test("workflow file helpers summarize validation issues for status output", () => {
  const message = formatValidationIssues([
    { path: "/steps/0/type", message: "Unknown action type: missing.action" },
    { path: "/steps/0/input", message: "must be object" },
    { path: "/steps/1/id", message: "Duplicate step id: step_1" },
    { path: "/steps/2/input", message: "Invalid reference" },
  ]);

  assert.match(message, /Unknown action type/);
  assert.match(message, /\+1 more/);
});

test("workflow file helpers derive stable yaml file names", () => {
  assert.equal(suggestWorkflowFileName({ name: "My Workflow", steps: [] }), "my-workflow.yaml");
  assert.equal(suggestWorkflowFileName({ name: "already.yml", steps: [] }), "already.yml");
  assert.equal(suggestWorkflowFileName({ steps: [] }), "workflow.yaml");
});
