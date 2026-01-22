import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeCrosslistHeatmap(papers, { referenceDate = new Date(), windowDays = 30 } = {}) {
  const ref = new Date(referenceDate);
  const windowStart = new Date(ref);
  windowStart.setUTCDate(windowStart.getUTCDate() - windowDays);

  const categories = new Set();
  const matrix = {};

  for (const paper of papers) {
    const submitted = toDate(paper.submitted_at);
    if (submitted && submitted < windowStart) continue;
    const primary = paper.primary_category;
    const cats = paper.categories ?? [];
    if (!primary || cats.length <= 1) continue;
    categories.add(primary);
    for (const cat of cats) categories.add(cat);
    if (!matrix[primary]) matrix[primary] = {};
    for (const cat of cats) {
      if (cat === primary) continue;
      matrix[primary][cat] = (matrix[primary][cat] ?? 0) + 1;
    }
  }

  const categoryList = Array.from(categories).sort();

  return {
    generated_at: ref.toISOString().slice(0, 10),
    window: `${windowDays}d`,
    categories: categoryList,
    matrix
  };
}

export async function writeCrosslistHeatmap({ dataDir = "data" } = {}) {
  const papers = JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8"));
  const data = computeCrosslistHeatmap(papers);
  await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "metrics/crosslist_heatmap.json"), JSON.stringify(data, null, 2));
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeCrosslistHeatmap().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
