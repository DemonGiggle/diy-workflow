import test from "node:test";
import assert from "node:assert/strict";
import { editorActions } from "./actionCatalog.js";
import { createTranslator, localizeAction, resources, supportedLocales } from "./i18n.js";

test("i18n resources cover every editor action and field", () => {
  for (const locale of supportedLocales) {
    const actionResources = resources[locale].actions;
    for (const action of editorActions) {
      const translation = actionResources[action.type];
      assert.ok(translation, `${locale} is missing action ${action.type}`);
      assert.ok(translation.label);
      assert.ok(translation.description);

      for (const field of action.inputFields) {
        assert.ok(translation.inputFields?.[field.name]?.label, `${locale} is missing ${action.type} input ${field.name}`);
      }
      for (const field of action.configFields) {
        assert.ok(translation.configFields?.[field.name]?.label, `${locale} is missing ${action.type} config ${field.name}`);
      }
      for (const field of action.outputFields) {
        assert.ok(translation.outputFields?.[field.name]?.label, `${locale} is missing ${action.type} output ${field.name}`);
      }
    }
  }
});

test("i18n localizes display text without changing workflow contract fields", () => {
  const readFile = editorActions.find((action) => action.type === "io.read_file");
  assert.ok(readFile);

  const localized = localizeAction(readFile, "zh-TW");
  assert.equal(localized.type, "io.read_file");
  assert.equal(localized.inputFields[0]?.name, "path");
  assert.equal(localized.outputFields.map((field) => field.name).join(","), "path,content,bytes");
  assert.equal(localized.label, "讀取檔案");
  assert.equal(localized.inputFields[0]?.label, "路徑");
});

test("i18n translator formats dynamic status messages", () => {
  assert.equal(createTranslator("en")("run.savedRuns", { count: 2 }), "2 saved run(s)");
  assert.equal(createTranslator("zh-TW")("run.loading", { runId: "run_0001" }), "載入 run_0001...");
  assert.equal(createTranslator("en")("yaml.saved", { fileName: "workflow.yaml" }), "Saved workflow.yaml");
});
