import { isDeepStrictEqual } from "node:util";
import type { ActionDefinition } from "../types.js";
import { anyMockValueSchema, readMockConfig } from "./mock.js";

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
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mock: {
        type: "object",
        nullable: true,
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean", nullable: true },
          matched: { type: "boolean", nullable: true },
          actual: anyMockValueSchema,
          expected: anyMockValueSchema,
        },
      },
    },
  },
  async run(input, _context, config) {
    const mock = readMockConfig(config);
    if (mock) {
      const actual = "actual" in mock ? mock.actual : input.actual;
      const expected = "expected" in mock ? mock.expected : input.expected;
      return {
        matched: typeof mock.matched === "boolean" ? mock.matched : isDeepStrictEqual(actual, expected),
        actual,
        expected,
      };
    }

    return { matched: isDeepStrictEqual(input.actual, input.expected), actual: input.actual, expected: input.expected };
  },
};
