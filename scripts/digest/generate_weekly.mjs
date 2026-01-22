import fs from "node:fs/promises";
import path from "node:path";

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return { year: target.getUTCFullYear(), week: weekNo };
}

function formatWeekLabel({ year, week }) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function generateWeeklyDigest({ now = new Date(), dryRun = false } = {}) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - 7);
  const label = formatWeekLabel(getISOWeek(date));
  const outputPath = path.join("src", "content", "digests", `${label}.mdx`);

  try {
    await fs.access(outputPath);
    console.log(`Digest ${label} already exists.`);
    return { created: false, path: outputPath };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const momentum = await loadJson(path.join("data", "metrics", "topic_momentum.json"));
  const versionChurn = await loadJson(path.join("data", "metrics", "version_churn.json"));
  const papers = await loadJson(path.join("data", "papers.index.json"));
  const topics = await loadJson(path.join("data", "taxonomy", "topics.json"));

  const momentumEntries = Object.entries(momentum.topics ?? momentum)
    .map(([topicId, value]) => ({ topicId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const topMomentumSection = momentumEntries
    .map(({ topicId, value }) => {
      const topic = topics.find((t) => t.id === topicId);
      const topPaper = papers
        .filter((paper) => (paper.topic_tags ?? []).some((tag) => tag.topic_id === topicId))
        .sort((a, b) => (b.metrics?.trending_score ?? 0) - (a.metrics?.trending_score ?? 0))[0];
      const arxiv = topPaper?.arxiv_id ?? topic?.anchors?.[0] ?? "";
      return `- **${topic?.title ?? topicId}** (momentum ${value}) -> ${topPaper?.title ?? "Anchor"} (arXiv ${arxiv})`;
    })
    .join("\n");

  const churnSection = (versionChurn.papers ?? [])
    .slice(0, 3)
    .map((paper) => `- ${paper.title} (arXiv ${paper.arxiv_id}, v${paper.version_count})`)
    .join("\n");

  const evidenceIds = momentumEntries
    .map(({ topicId }) => {
      const paper = papers.find((item) => (item.topic_tags ?? []).some((tag) => tag.topic_id === topicId));
      return paper?.arxiv_id;
    })
    .filter(Boolean);

  const content = `---\nweek: "${label}"\ntitle: "Weekly Digest - ${label}"\nsummary: "Momentum shifts and high-activity papers across causal AI."\nevidence_arxiv:\n${evidenceIds.map((id) => `  - "${id}"`).join("\n")}\n---\nimport Claim from "../../components/Claim.astro";\n\n<Claim evidence={[${evidenceIds.map((id) => `\"${id}\"`).join(", ")}]} type="Signal">\n  This week's momentum leaders clustered around ${momentumEntries.map((m) => m.topicId).join(", ")}.\n</Claim>\n\n## Momentum highlights\n${topMomentumSection || "- No momentum data yet."}\n\n## Version churn watchlist\n${churnSection || "- No high-churn papers this week."}\n`;

  if (!dryRun) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content);
  }

  return { created: true, path: outputPath, content };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateWeeklyDigest().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
