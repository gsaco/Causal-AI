import fs from "node:fs/promises";
import path from "node:path";

const stopwords = new Set([
  "the", "a", "an", "and", "or", "for", "with", "to", "of", "in", "on", "by", "from", "via",
  "using", "toward", "towards", "under", "over", "into", "model", "models", "learning"
]);

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

export async function writeEmergingClusters({ dataDir = "data", maxClusters = 10 } = {}) {
  const indexRaw = await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8");
  const papers = JSON.parse(indexRaw);

  const clusters = new Map();
  for (const paper of papers) {
    const tokens = tokenize(paper.title || "");
    const key = tokens[0] ?? "misc";
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(paper.arxiv_id);
  }

  const sorted = Array.from(clusters.entries())
    .map(([keyword, ids]) => ({ keyword, ids }))
    .sort((a, b) => b.ids.length - a.ids.length)
    .slice(0, maxClusters);

  const output = {
    generated_at: formatDate(),
    window_days: 30,
    clusters: sorted.map((cluster, idx) => ({
      id: `cluster-${idx + 1}`,
      keywords: [cluster.keyword],
      papers: cluster.ids.slice(0, 5)
    }))
  };

  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "metrics", "emerging_clusters.json"), JSON.stringify(output, null, 2));
  console.log("Emerging clusters generated.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeEmergingClusters().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
