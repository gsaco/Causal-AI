import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeVersionChurn(papers, { referenceDate = new Date(), windowDays = 30, limit = 50 } = {}) {
  const ref = new Date(referenceDate);
  const windowStart = new Date(ref);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const candidates = papers
    .filter((paper) => (paper.metrics?.version_count ?? 1) >= 2)
    .filter((paper) => {
      const updated = toDate(paper.updated_at);
      return updated && updated >= windowStart;
    })
    .map((paper) => {
      const versionCount = paper.metrics?.version_count ?? 1;
      const updated = toDate(paper.updated_at);
      const recency = updated
        ? Math.exp((-Math.log(2) * (ref - updated) / (1000 * 60 * 60 * 24)) / 30)
        : 0;
      const score = versionCount * 0.7 + recency * 0.3;
      return { paper, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ paper }) => ({
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      updated_at: paper.updated_at,
      version_count: paper.metrics?.version_count ?? 1,
      primary_category: paper.primary_category,
      links: paper.links
    }));

  return {
    generated_at: ref.toISOString().slice(0, 10),
    window: `${windowDays}d`,
    papers: candidates
  };
}

export async function writeVersionChurn({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const data = computeVersionChurn(papers);
  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "metrics/version_churn.json"), JSON.stringify(data, null, 2));
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeVersionChurn().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
