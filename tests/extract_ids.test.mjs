import test from "node:test";
import assert from "node:assert/strict";
import { extractArxivIds } from "../scripts/validate/extract_arxiv_ids.mjs";

test("extract arXiv ids from content", async () => {
  const ids = await extractArxivIds({ includeAnchors: true });
  assert.ok(ids.has("1803.01422"));
});
