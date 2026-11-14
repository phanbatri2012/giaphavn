import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const TEXT_EXTENSIONS = new Set([".css", ".json", ".md", ".sql", ".ts", ".tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return TEXT_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

describe("Vietnamese source text", () => {
  it("is stored in Unicode NFC form", () => {
    const root = join(process.cwd(), "src");
    const nonNormalized = sourceFiles(root).flatMap((file) =>
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .flatMap((line, index) =>
          line === line.normalize("NFC") ? [] : [`${relative(process.cwd(), file)}:${index + 1}`]
        )
    );
    expect(nonNormalized).toEqual([]);
  });
});
