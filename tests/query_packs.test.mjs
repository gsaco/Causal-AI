import test from "node:test";
import assert from "node:assert/strict";
import { buildHarvestPlan, loadQueryPacks } from "../scripts/arxiv/query_packs.mjs";

test("query packs load with unique ids and build a harvest plan", async () => {
  const packs = await loadQueryPacks();
  const ids = packs.map((pack) => pack.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(packs.every((pack) => pack.candidate_queries.length > 0));

  const plan = buildHarvestPlan(packs);
  assert.ok(plan.length > packs.length);
  assert.ok(plan.every((task) => task.packId && task.queryId && task.query));
});
