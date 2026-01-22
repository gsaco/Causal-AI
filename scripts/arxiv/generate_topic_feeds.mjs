import fs from "node:fs/promises";
import path from "node:path";

function sortByDateDesc(a, b, field) {
  return new Date(b[field]).getTime() - new Date(a[field]).getTime();
}

export async function generateTopicFeeds({
  dataDir = "data",
  limitLatest = 12,
  limitTrending = 12,
  papers,
  topics
} = {}) {
  const topicsData = topics ?? JSON.parse(await fs.readFile(path.join(dataDir, "taxonomy/topics.json"), "utf-8"));
  const papersData = papers ?? JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const feedsDir = path.join(dataDir, "topic_feeds");
  await fs.mkdir(feedsDir, { recursive: true });

  const now = new Date().toISOString().slice(0, 10);

  for (const topic of topicsData) {
    const tagged = papersData.filter((paper) =>
      (paper.topic_tags ?? []).some((tag) => tag.topic_id === topic.id)
    );

    const latest = [...tagged]
      .sort((a, b) => sortByDateDesc(a, b, "submitted_at"))
      .slice(0, limitLatest)
      .map((paper) => paper.arxiv_id);

    const trending = [...tagged]
      .sort((a, b) => (b.metrics?.trending_score ?? 0) - (a.metrics?.trending_score ?? 0))
      .slice(0, limitTrending)
      .map((paper) => paper.arxiv_id);

    const feed = {
      topic: topic.id,
      generated_at: now,
      latest,
      trending
    };

    await fs.writeFile(path.join(feedsDir, `${topic.id}.json`), JSON.stringify(feed, null, 2));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateTopicFeeds().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
