import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function loadJson(relativePath) {
  const raw = await fs.readFile(path.join(process.cwd(), "data", relativePath), "utf-8");
  return JSON.parse(raw);
}

test("navigator data stays in sync with the paper index", async () => {
  const [papers, catalog, facets, lenses, pages] = await Promise.all([
    loadJson("papers.index.json"),
    loadJson("navigator/catalog.json"),
    loadJson("navigator/facets.json"),
    loadJson("navigator/lenses.json"),
    loadJson("navigator/pages.json")
  ]);

  assert.equal(catalog.length, papers.length);
  assert.equal(facets.counts.papers, papers.length);
  assert.equal(lenses.lenses.latest.length, papers.length);
  assert.ok(Object.keys(pages.lenses.latest).length > 0);
  assert.ok(Object.values(pages.lenses.latest).every((page) => page.length <= pages.page_size));
});
