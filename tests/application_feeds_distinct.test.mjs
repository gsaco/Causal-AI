import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

test("application feeds are not all identical", async () => {
  const dir = path.join(process.cwd(), "data", "applications");
  const files = (await fs.readdir(dir))
    .filter((file) => file.endsWith(".json") && file !== "registry.json")
    .sort();

  const signatures = [];
  for (const file of files) {
    const data = JSON.parse(await fs.readFile(path.join(dir, file), "utf-8"));
    signatures.push(JSON.stringify({ latest: data.latest, trending: data.trending }));
  }

  assert.ok(new Set(signatures).size > 1);
});
