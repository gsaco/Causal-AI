import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const arxivIdPattern = /^(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})$/i;

async function listJson(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "registry.json")
    .map((entry) => path.join(dir, entry.name));
}

test("application feeds contain arXiv IDs", async () => {
  const dir = path.join(process.cwd(), "data", "applications");
  const files = await listJson(dir);
  assert.ok(files.length > 0, "expected application feed files");
  for (const file of files) {
    const raw = await fs.readFile(file, "utf-8");
    const data = JSON.parse(raw);
    for (const id of [...(data.latest ?? []), ...(data.trending ?? [])]) {
      assert.match(id, arxivIdPattern);
    }
  }
});
