import type { ActionDefinition } from "./types.js";

export class ActionRegistry {
  private readonly actions = new Map<string, ActionDefinition>();

  register(action: ActionDefinition): void {
    if (this.actions.has(action.type)) {
      throw new Error(`Action already registered: ${action.type}`);
    }
    this.actions.set(action.type, action);
  }

  get(type: string): ActionDefinition | undefined {
    return this.actions.get(type);
  }

  list(): ActionDefinition[] {
    return [...this.actions.values()].sort((a, b) => a.type.localeCompare(b.type));
  }
}

