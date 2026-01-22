import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysAgo(reference, days) {
  const date = new Date(reference);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function computeTopicMomentum(papers, topics, { referenceDate = new Date(), windowA = 7, windowB = 14 } = {}) {
  const ref = new Date(referenceDate);
  const startA = daysAgo(ref, windowA);
  const startB = daysAgo(ref, windowA + windowB);
  const endB = daysAgo(ref, windowA);

  const countsA = new Map();
  const countsB = new Map();

  for (const topic of topics) {
    countsA.set(topic.id, 0);
    countsB.set(topic.id, 0);
  }

  for (const paper of papers) {
    const submitted = toDate(paper.submitted_at);
    if (!submitted) continue;
    const topicIds = (paper.topic_tags ?? []).map((tag) => tag.topic_id);
    if (submitted >= startA) {
      for (const id of topicIds) countsA.set(id, (countsA.get(id) ?? 0) + 1);
    } else if (submitted >= startB && submitted < endB) {
      for (const id of topicIds) countsB.set(id, (countsB.get(id) ?? 0) + 1);
    }
  }

  const momentum = {};
  for (const topic of topics) {
    const countA = countsA.get(topic.id) ?? 0;
    const countB = countsB.get(topic.id) ?? 0;
    const normalizedBaseline = windowB > 0 ? countB * (windowA / windowB) : 0;
    const denom = Math.max(1, normalizedBaseline);
    const value = (countA - normalizedBaseline) / denom;
    momentum[topic.id] = Number(value.toFixed(3));
  }

  return {
    generated_at: formatDate(ref),
    window: {
      A: `${formatDate(startA)}_to_${formatDate(ref)}`,
      B: `${formatDate(startB)}_to_${formatDate(endB)}`
    },
    topics: momentum
  };
}

export async function writeTopicMomentum({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const topics = JSON.parse(await fs.readFile(path.join(dataDir, "taxonomy/topics.json"), "utf-8"));
  const configPath = path.join(dataDir, "ranking/config.json");
  let windowA = 7;
  let windowB = 14;
  try {
    const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
    windowA = config.momentum_window_days ?? windowA;
    windowB = config.baseline_window_days ?? windowB;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const momentum = computeTopicMomentum(papers, topics, { windowA, windowB });
  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(
    path.join(dataDir, "metrics/topic_momentum.json"),
    JSON.stringify(momentum, null, 2)
  );
  return momentum;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeTopicMomentum().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
