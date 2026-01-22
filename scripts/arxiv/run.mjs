import fs from "node:fs/promises";
import path from "node:path";
import { fetchPage } from "./arxiv_atom.mjs";
import { normalizeEntry } from "./normalize.mjs";
import { writeSnapshots } from "./write_snapshots.mjs";
import { ensureEvidence } from "./ensure_evidence.mjs";
import { tagTopics } from "./tag_topics.mjs";
import { computeTopicMomentum } from "./metrics_topic_momentum.mjs";
import { computeTrending } from "./trending.mjs";
import { generateTopicFeeds } from "./generate_topic_feeds.mjs";
import { generateApplicationFeeds } from "./generate_application_feeds.mjs";
import { writeTopicTimeseries } from "./metrics_topic_timeseries.mjs";
import { writeTrendRadar } from "./metrics_trend_radar.mjs";
import { writeCrosslistHeatmap } from "./metrics_crosslist_heatmap.mjs";
import { writeVersionChurn } from "./metrics_version_churn.mjs";
import { writeEmergingClusters } from "./metrics_emerging_clusters.mjs";
import { buildAtlasGraph } from "./build_atlas_graph.mjs";
import { writeProvenance } from "./provenance.mjs";
import { computeCoverage } from "../validate/compute_coverage.mjs";
import { harvestOai } from "./oai_harvest.mjs";

function getArgValue(prefix, fallback) {
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return fallback;
  const value = arg.split("=")[1];
  return value ?? fallback;
}

function parseBooleanFlag(flag) {
  return process.argv.includes(flag);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function loadAllPapers(dataDir) {
  const papersDir = path.join(dataDir, "papers");
  const papers = [];
  const files = await fs.readdir(papersDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const raw = await fs.readFile(path.join(papersDir, file), "utf-8");
    papers.push(JSON.parse(raw));
  }
  return papers;
}

async function fetchTopicEntries(topics, { maxPerTopic = 200, offline = false } = {}) {
  if (offline) return [];
  const harvestedAt = new Date().toISOString();
  const harvestRunId = `snapshot-${formatDate(new Date())}`;
  const normalized = [];

  for (const topic of topics) {
    if (!topic.query) continue;
    let start = 0;
    const pageSize = Math.min(100, maxPerTopic);
    let fetched = 0;
    while (fetched < maxPerTopic) {
      const { entries } = await fetchPage({
        search_query: topic.query,
        start,
        max_results: pageSize
      });
      if (entries.length === 0) break;
      for (const entry of entries) {
        normalized.push(
          normalizeEntry(entry, {
            query: topic.query,
            harvestedAt,
            harvestRunId
          })
        );
      }
      fetched += entries.length;
      if (entries.length < pageSize) break;
      start += pageSize;
    }
  }

  return normalized;
}

async function updateEditorialLedger({ dataDir, rankingVersion }) {
  if (!rankingVersion) return;
  const ledgerPath = path.join(dataDir, "editorial", "ledger.ndjson");
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  let existing = "";
  try {
    existing = await fs.readFile(ledgerPath, "utf-8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing.includes(`\"ranking_config\":\"${rankingVersion}\"`)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    type: "ranking-config",
    ranking_config: rankingVersion,
    note: "Ranking config version updated"
  };
  await fs.appendFile(ledgerPath, `${JSON.stringify(entry)}\n`);
}

export async function runPipeline() {
  const dataDir = "data";
  const windowDays = Number(getArgValue("--windowDays=", "30"));
  const maxPerTopic = Number(getArgValue("--maxPerTopic=", "200"));
  const dryRun = parseBooleanFlag("--dryRun");
  const offline = parseBooleanFlag("--offline");
  const useOai = parseBooleanFlag("--useOai=true");

  const topics = await loadJson(path.join(dataDir, "taxonomy", "topics.json"));
  const rankingConfig = await loadJson(path.join(dataDir, "ranking", "config.json"));
  const queryPack = await loadJson(path.join(dataDir, "editorial", "query-pack-version.json")).catch(() => ({ version: "" }));

  if (useOai && !offline) {
    await harvestOai({ dataDir });
  }

  await ensureEvidence({ offline, harvestRunId: `evidence-${formatDate(new Date())}` });

  const harvested = await fetchTopicEntries(topics, { maxPerTopic, offline });
  if (harvested.length > 0) {
    await writeSnapshots(harvested, { dataDir });
  }

  const papers = await loadAllPapers(dataDir);
  const tagged = tagTopics(papers, topics, { rulesVersion: "v1" });

  const momentum = computeTopicMomentum(tagged, topics, {
    windowA: rankingConfig.momentum_window_days,
    windowB: rankingConfig.baseline_window_days
  });
  if (!dryRun) {
    await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "metrics", "topic_momentum.json"),
      JSON.stringify(momentum, null, 2)
    );
  }

  const trended = computeTrending(tagged, momentum.topics, rankingConfig);
  if (!dryRun) {
    await writeSnapshots(trended, { dataDir });
  }

  if (!dryRun) {
    await generateTopicFeeds({ dataDir, limitLatest: 12, limitTrending: 12 });
    await generateApplicationFeeds({ dataDir, windowDays, limitLatest: 12, limitTrending: 12 });
    await writeTopicTimeseries({ dataDir });
    await writeTrendRadar({ dataDir });
    await writeCrosslistHeatmap({ dataDir });
    await writeVersionChurn({ dataDir });
    await writeEmergingClusters({ dataDir });
    await buildAtlasGraph({ dataDir });
    await computeCoverage({ dataDir, writeOutput: true });
  }

  await updateEditorialLedger({ dataDir, rankingVersion: rankingConfig.version });

  const harvestWindow = `${formatDate(new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000))} to ${formatDate(new Date())}`;
  const records = trended.length;
  await writeProvenance({
    dataDir,
    harvestWindow,
    source: "arxiv_api",
    dataset: offline ? "offline" : "prod",
    records,
    rankingConfigVersion: rankingConfig.version,
    queryPackVersion: queryPack.version ?? ""
  });

  console.log(`Pipeline complete. Papers: ${records}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
