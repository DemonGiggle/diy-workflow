import { ActionRegistry } from "../registry.js";
import { faninAction, fanoutAction } from "./control.js";
import { exactMatchAction } from "./eval.js";
import { readFileAction, writeFileAction, writeStdoutAction } from "./io.js";
import { readImageAction, writeImageAction } from "./image.js";
import { promptAction, summarizeAction } from "./llm.js";
import { ocrAction, visionAnalyzeAction } from "./image.js";
import { watchDirAction } from "./trigger.js";

export function createDefaultRegistry(): ActionRegistry {
  const registry = new ActionRegistry();
  registry.register(watchDirAction);
  registry.register(readFileAction);
  registry.register(writeFileAction);
  registry.register(writeStdoutAction);
  registry.register(promptAction);
  registry.register(visionAnalyzeAction);
  registry.register(ocrAction);
  registry.register(readImageAction);
  registry.register(writeImageAction);
  registry.register(summarizeAction);
  registry.register(fanoutAction);
  registry.register(faninAction);
  registry.register(exactMatchAction);
  return registry;
}
