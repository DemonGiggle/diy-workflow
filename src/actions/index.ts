import { ActionRegistry } from "../registry.js";
import { faninAction, fanoutAction } from "./control.js";
import { exactMatchAction } from "./eval.js";
import { readFileAction } from "./io.js";
import { readImageAction } from "./image.js";
import { promptAction, summarizeAction } from "./llm.js";
import { ocrAction, visionAnalyzeAction } from "./image.js";

export function createDefaultRegistry(): ActionRegistry {
  const registry = new ActionRegistry();
  registry.register(readFileAction);
  registry.register(promptAction);
  registry.register(visionAnalyzeAction);
  registry.register(ocrAction);
  registry.register(readImageAction);
  registry.register(summarizeAction);
  registry.register(fanoutAction);
  registry.register(faninAction);
  registry.register(exactMatchAction);
  return registry;
}
