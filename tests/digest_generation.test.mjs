import test from "node:test";
import assert from "node:assert/strict";
import { generateWeeklyDigest } from "../scripts/digest/generate_weekly.mjs";

test("generate weekly digest content", async () => {
  const result = await generateWeeklyDigest({
    now: new Date("2026-01-22T00:00:00Z"),
    dryRun: true
  });
  assert.ok(result.content.includes("<Claim"));
  assert.ok(result.content.includes("evidence"));
});
