import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { Paper } from "../scripts/arxiv/schema.mjs";

test("Paper schema validates sample data", async () => {
  const raw = await fs.readFile(path.join("data", "papers", "1907.02893.json"), "utf-8");
  const paper = JSON.parse(raw);
  const result = Paper.safeParse(paper);
  assert.equal(result.success, true);
});
