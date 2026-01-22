import test from "node:test";
import assert from "node:assert/strict";
import { tagPaper } from "../scripts/arxiv/tag_topics.mjs";

test("tagging assigns topic tags based on keywords", () => {
  const paper = {
    title: "Invariant Risk Minimization for Distribution Shift",
    abstract: "We study invariant predictors.",
    primary_category: "cs.LG"
  };
  const topics = [
    {
      id: "distribution-shift",
      keywords_any: ["invariant", "distribution shift"],
      keywords_all: [],
      exclude_keywords: [],
      category_whitelist: ["cs.LG"]
    }
  ];
  const tags = tagPaper(paper, topics);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].topic_id, "distribution-shift");
});
