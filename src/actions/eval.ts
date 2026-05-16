import { isDeepStrictEqual } from "node:util";
import type { ActionDefinition } from "../types.js";

interface ExactMatchInput {
  actual: unknown;
  expected: unknown;
}

interface ExactMatchOutput {
  matched: boolean;
  actual: unknown;
  expected: unknown;
}

export const exactMatchAction: ActionDefinition<ExactMatchInput, ExactMatchOutput> = {
  type: "eval.exact_match",
  description: "Compare actual and expected values using strict deep equality.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["actual", "expected"],
    properties: {
      actual: {},
      expected: {},
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["matched", "actual", "expected"],
    properties: {
      matched: { type: "boolean" },
      actual: {},
      expected: {},
    },
  },
  async run(input) {
    return { matched: isDeepStrictEqual(input.actual, input.expected), actual: input.actual, expected: input.expected };
  },
};

