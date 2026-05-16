import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActionDefinition } from "../types.js";

interface ReadFileInput {
  path: string;
  encoding?: BufferEncoding;
}

interface ReadFileOutput {
  path: string;
  content: string;
  bytes: number;
}

export const readFileAction: ActionDefinition<ReadFileInput, ReadFileOutput> = {
  type: "io.read_file",
  description: "Read a UTF-8 text file from the local workspace.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string", minLength: 1 },
      encoding: { type: "string", nullable: true },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "content", "bytes"],
    properties: {
      path: { type: "string" },
      content: { type: "string" },
      bytes: { type: "number" },
    },
  },
  async run(input, context) {
    const encoding = input.encoding ?? "utf8";
    const absolute = resolve(context.cwd, input.path);
    const [content, info] = await Promise.all([readFile(absolute, encoding), stat(absolute)]);
    return { path: absolute, content, bytes: info.size };
  },
};

