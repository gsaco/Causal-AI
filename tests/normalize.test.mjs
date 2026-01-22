import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parseAtomXml } from "../scripts/arxiv/arxiv_atom.mjs";
import { normalizeEntry } from "../scripts/arxiv/normalize.mjs";

test("normalize Atom entry to Paper", async () => {
  const xml = await fs.readFile(
    path.join("scripts", "arxiv", "fixtures", "atom_sample.xml"),
    "utf-8"
  );
  const { entries } = parseAtomXml(xml);
  const paper = normalizeEntry(entries[0], {
    query: "cat:cs.LG",
    harvestedAt: "2026-01-22T00:00:00Z",
    harvestRunId: "test"
  });
  assert.equal(paper.arxiv_id, "1907.02893");
  assert.ok(paper.title.length > 0);
  assert.equal(paper.metrics.cross_list_count, paper.categories.length - 1);
  assert.equal(paper.provenance.harvest_run_id, "test");
});
