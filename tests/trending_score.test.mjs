import test from "node:test";
import assert from "node:assert/strict";
import { computeTrending } from "../scripts/arxiv/trending.mjs";

test("trending score orders recent papers higher", () => {
  const papers = [
    {
      arxiv_id: "1",
      submitted_at: "2026-01-20",
      updated_at: "2026-01-20",
      primary_category: "cs.LG",
      metrics: { cross_list_count: 0, version_count: 1 },
      topic_tags: []
    },
    {
      arxiv_id: "2",
      submitted_at: "2025-12-01",
      updated_at: "2025-12-01",
      primary_category: "cs.LG",
      metrics: { cross_list_count: 0, version_count: 1 },
      topic_tags: []
    }
  ];
  const config = {
    weights: { recency: 0.6, momentum: 0.2, cross_list: 0.1, churn: 0.1 },
    recency_half_life_days: 14
  };
  const scored = computeTrending(papers, {}, config, { referenceDate: new Date("2026-01-22") });
  assert.ok(scored[0].metrics.trending_score >= scored[1].metrics.trending_score);
});
