import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { parseAtomXml } from "../scripts/arxiv/arxiv_atom.mjs";

test("parse Atom XML fixture", async () => {
  const xml = await fs.readFile(
    path.join("scripts", "arxiv", "fixtures", "atom_sample.xml"),
    "utf-8"
  );
  const { entries } = parseAtomXml(xml);
  assert.ok(entries.length > 0);
  assert.match(entries[0].arxiv_id, /\d{4}\.\d{4,5}/);
});
