import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

export function computeTrendRadar(papers, topics, momentumMap, { referenceDate = new Date(), windowDays = 30 } = {}) {
  const ref = new Date(referenceDate);
  const windowStart = new Date(ref);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const stats = {};
  for (const topic of topics) {
    stats[topic.id] = {
      recentCount: 0,
      crossListSum: 0,
      churnSum: 0,
      total: 0
    };
  }

  for (const paper of papers) {
    const submitted = toDate(paper.submitted_at);
    const updated = toDate(paper.updated_at);
    const isRecent = submitted && submitted >= windowStart;
    const versionCount = paper.metrics?.version_count ?? 1;
    const churn = Math.min(1, Math.max(0, (versionCount - 1) / 3)) *
      (updated ? Math.exp((-Math.log(2) * (ref - updated) / (1000 * 60 * 60 * 24)) / 30) : 0);

    for (const tag of paper.topic_tags ?? []) {
      const entry = stats[tag.topic_id];
      if (!entry) continue;
      if (isRecent) entry.recentCount += 1;
      entry.crossListSum += paper.metrics?.cross_list_count ?? 0;
      entry.churnSum += churn;
      entry.total += 1;
    }
  }

  const maxRecent = Math.max(...Object.values(stats).map((stat) => stat.recentCount), 1);
  const maxCross = Math.max(...Object.values(stats).map((stat) => stat.crossListSum / (stat.total || 1)), 1);
  const maxChurn = Math.max(...Object.values(stats).map((stat) => stat.churnSum / (stat.total || 1)), 1);

  const topicsOut = {};
  for (const topic of topics) {
    const stat = stats[topic.id];
    const crossAvg = stat.total ? stat.crossListSum / stat.total : 0;
    const churnAvg = stat.total ? stat.churnSum / stat.total : 0;
    const momentumValue = momentumMap[topic.id] ?? 0;
    topicsOut[topic.id] = {
      momentum: clamp((momentumValue + 1) / 2),
      recency_share: clamp(stat.recentCount / maxRecent),
      cross_list_breadth: clamp(crossAvg / maxCross),
      revision_churn: clamp(churnAvg / maxChurn)
    };
  }

  return {
    generated_at: ref.toISOString().slice(0, 10),
    topics: topicsOut
  };
}

export async function writeTrendRadar({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const topics = JSON.parse(await fs.readFile(path.join(dataDir, "taxonomy/topics.json"), "utf-8"));
  const momentum = JSON.parse(await fs.readFile(path.join(dataDir, "metrics/topic_momentum.json"), "utf-8"));
  const data = computeTrendRadar(papers, topics, momentum.topics ?? momentum);
  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "metrics/trend_radar.json"), JSON.stringify(data, null, 2));
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeTrendRadar().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
