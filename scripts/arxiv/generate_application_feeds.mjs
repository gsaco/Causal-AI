import fs from "node:fs/promises";
import path from "node:path";

function getArgValue(prefix, fallback) {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;
  const value = arg.split("=")[1];
  return value ?? fallback;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function byUpdatedAtDesc(a, b) {
  const aTime = new Date(a.updated_at ?? a.submitted_at ?? 0).getTime();
  const bTime = new Date(b.updated_at ?? b.submitted_at ?? 0).getTime();
  return bTime - aTime;
}

function byTrendingDesc(a, b) {
  return (b.metrics?.trending_score ?? 0) - (a.metrics?.trending_score ?? 0);
}

export async function generateApplicationFeeds({
  dataDir = "data",
  windowDays = 30,
  limitLatest = 12,
  limitTrending = 12,
  papers
} = {}) {
  const registryPath = path.join(dataDir, "applications", "registry.json");
  const indexPath = path.join(dataDir, "papers.index.json");

  const [registryRaw, indexPayload] = await Promise.all([
    fs.readFile(registryPath, "utf-8"),
    papers ? Promise.resolve(JSON.stringify(papers)) : fs.readFile(indexPath, "utf-8")
  ]);
  const registry = JSON.parse(registryRaw);
  const papersData = JSON.parse(indexPayload);

  const windowStart = formatDate(new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000));
  const windowEnd = formatDate(new Date());
  const window = `${windowStart} to ${windowEnd}`;

  await fs.mkdir(path.join(dataDir, "applications"), { recursive: true });

  for (const entry of registry) {
    const matching = papersData.filter((paper) => (paper.application_tags ?? []).includes(entry.slug));
    const latest = [...matching].sort(byUpdatedAtDesc).slice(0, limitLatest).map((paper) => paper.arxiv_id);
    const trending = [...matching].sort(byTrendingDesc).slice(0, limitTrending).map((paper) => paper.arxiv_id);

    const output = {
      latest,
      trending,
      query: entry.query,
      window
    };

    const outPath = path.join(dataDir, "applications", `${entry.slug}.json`);
    await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  }

  console.log("Application feeds generated.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const windowDays = Number(getArgValue("--windowDays=", "30"));
  const limitLatest = Number(getArgValue("--limitLatest=", "12"));
  const limitTrending = Number(getArgValue("--limitTrending=", "12"));
  generateApplicationFeeds({ windowDays, limitLatest, limitTrending }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
