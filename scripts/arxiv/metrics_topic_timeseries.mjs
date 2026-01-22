import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week: weekNo };
}

function formatWeekLabel({ year, week }) {
  const padded = String(week).padStart(2, "0");
  return `${year}-W${padded}`;
}

export function computeTopicTimeseries(papers, topics, { referenceDate = new Date(), weeksBack = 52 } = {}) {
  const ref = new Date(referenceDate);
  const weeks = [];
  const weekSet = new Set();

  for (let i = weeksBack - 1; i >= 0; i -= 1) {
    const date = new Date(ref);
    date.setUTCDate(ref.getUTCDate() - i * 7);
    const label = formatWeekLabel(getISOWeek(date));
    if (!weekSet.has(label)) {
      weeks.push(label);
      weekSet.add(label);
    }
  }

  const topicSeries = {};
  for (const topic of topics) {
    topicSeries[topic.id] = Array(weeks.length).fill(0);
  }

  for (const paper of papers) {
    const submitted = toDate(paper.submitted_at);
    if (!submitted) continue;
    const label = formatWeekLabel(getISOWeek(submitted));
    const index = weeks.indexOf(label);
    if (index === -1) continue;
    for (const tag of paper.topic_tags ?? []) {
      if (!topicSeries[tag.topic_id]) continue;
      topicSeries[tag.topic_id][index] += 1;
    }
  }

  return {
    generated_at: ref.toISOString().slice(0, 10),
    weeks,
    topics: topicSeries
  };
}

export async function writeTopicTimeseries({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const topics = JSON.parse(await fs.readFile(path.join(dataDir, "taxonomy/topics.json"), "utf-8"));
  const data = computeTopicTimeseries(papers, topics);
  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "metrics/topic_timeseries.json"), JSON.stringify(data, null, 2));
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeTopicTimeseries().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
