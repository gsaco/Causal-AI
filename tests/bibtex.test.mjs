import test from "node:test";
import assert from "node:assert/strict";
import { toBibTex } from "../src/lib/bibtex.js";

const sample = {
  arxiv_id: "1803.01422",
  title: "DAGs with NO TEARS: Continuous Optimization for Structure Learning",
  authors: [{ name: "Xun Zheng" }, { name: "Bryan Aragam" }],
  submitted_at: "2018-03-05",
  primary_category: "stat.ML"
};

test("bibtex generator is stable", () => {
  const entry = toBibTex(sample);
  assert.match(entry, /@article\{arxiv:1803.01422/);
  assert.match(entry, /title=\{DAGs with NO TEARS/);
  assert.match(entry, /author=\{Xun Zheng and Bryan Aragam/);
});
