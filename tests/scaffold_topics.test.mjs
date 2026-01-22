import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { renderTopic } from "../scripts/content/scaffold_topics.mjs";

const topicsPath = new URL("../data/taxonomy/topics.json", import.meta.url);
const templatePath = new URL("../templates/topic.mdx", import.meta.url);

test("topic scaffold output is deterministic", async () => {
  const [topicsRaw, template] = await Promise.all([
    fs.readFile(topicsPath, "utf-8"),
    fs.readFile(templatePath, "utf-8")
  ]);
  const topics = JSON.parse(topicsRaw);
  const sample = topics[0];
  const first = renderTopic({ topic: sample, template });
  const second = renderTopic({ topic: sample, template });
  assert.equal(first, second);
});
