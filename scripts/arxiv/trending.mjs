import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recencyScore(dateValue, reference, halfLifeDays) {
  const date = toDate(dateValue);
  if (!date) return 0;
  const diffMs = reference.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const decay = Math.exp((-Math.log(2) * diffDays) / halfLifeDays);
  return Number.isFinite(decay) ? decay : 0;
}

export function computeTrending(papers, momentumByTopic, config, { referenceDate = new Date() } = {}) {
  const ref = new Date(referenceDate);
  const weights = config.weights;
  const halfLife = config.recency_half_life_days ?? 14;

  return papers.map((paper) => {
    const recency = recencyScore(paper.submitted_at, ref, halfLife);
    const updatedRecency = recencyScore(paper.updated_at, ref, 30);
    const topicMomentum = (paper.topic_tags ?? [])
      .map((tag) => momentumByTopic[tag.topic_id] ?? 0)
      .reduce((sum, value, _, arr) => sum + value / (arr.length || 1), 0);
    const crossList = Math.min(1, (paper.metrics?.cross_list_count ?? 0) / 3);
    const versionCount = paper.metrics?.version_count ?? 1;
    const churn = Math.min(1, Math.max(0, (versionCount - 1) / 3)) * updatedRecency;

    const score =
      weights.recency * recency +
      weights.momentum * topicMomentum +
      weights.cross_list * crossList +
      weights.churn * churn;

    return {
      ...paper,
      metrics: {
        ...paper.metrics,
        trending_score: Number(score.toFixed(4))
      }
    };
  });
}

export async function writeTrending({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const momentum = JSON.parse(
    await fs.readFile(path.join(dataDir, "metrics/topic_momentum.json"), "utf-8")
  );
  const config = JSON.parse(await fs.readFile(path.join(dataDir, "ranking/config.json"), "utf-8"));
  const updated = computeTrending(papers, momentum.topics ?? momentum, config);
  await fs.writeFile(path.join(dataDir, "papers.index.json"), JSON.stringify(updated, null, 2));
  return updated;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeTrending().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
