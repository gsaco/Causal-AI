import fs from "node:fs/promises";
import path from "node:path";
import { fetchAllByQuery, fetchPage } from "./arxiv_atom.mjs";
import { normalizeEntry } from "./normalize.mjs";
import { mergePaperRecords, writeSnapshots } from "./write_snapshots.mjs";
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
import { buildHarvestPlan, collectSeedPaperIds, loadQueryPacks } from "./query_packs.mjs";
import {
  filterAndEnrichCorpus,
  loadApplicationRegistry,
  scoreCorpusForRanking
} from "./enrich_corpus.mjs";
import { generateNavigatorData } from "./generate_navigator_data.mjs";
import { extractArxivIds } from "../validate/extract_arxiv_ids.mjs";

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
  try {
    const files = await fs.readdir(papersDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(papersDir, file), "utf-8");
      papers.push(JSON.parse(raw));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return papers;
}

function mergePaperList(papers) {
  const merged = new Map();
  for (const paper of papers) {
    const current = merged.get(paper.arxiv_id);
    merged.set(paper.arxiv_id, mergePaperRecords(current, paper));
  }
  return Array.from(merged.values());
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchPlanEntries(plan, { offline = false } = {}) {
  if (offline) return [];
  const harvestedAt = new Date().toISOString();
  const harvestRunId = `snapshot-${formatDate(new Date())}`;
  const normalized = [];

  for (const task of plan) {
    const { entries } = await fetchPage({
      search_query: task.query,
      start: 0,
      max_results: task.maxResults,
      sortBy: task.sortBy,
      sortOrder: task.sortOrder
    });
    for (const entry of entries) {
      normalized.push(
        normalizeEntry(entry, {
          query: task.query,
          queryPackId: task.packId,
          harvestedAt,
          harvestRunId
        })
      );
    }
  }

  return normalized;
}

async function hydratePaperIds(ids, { offline = false, reason = "hydrate" } = {}) {
  if (offline || ids.length === 0) return [];
  const harvestedAt = new Date().toISOString();
  const normalized = [];
  const chunks = chunkArray(Array.from(new Set(ids)), 25);

  for (const chunk of chunks) {
    const idList = chunk.join(",");
    const entries = await fetchAllByQuery({ id_list: idList, max_results: chunk.length });
    for (const entry of entries) {
      normalized.push(
        normalizeEntry(entry, {
          query: `id_list:${reason}:${idList}`,
          harvestedAt,
          harvestRunId: `${reason}-${formatDate(new Date())}`
        })
      );
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
  const windowDays = Number(getArgValue("--windowDays=", "120"));
  const dryRun = parseBooleanFlag("--dryRun");
  const offline = parseBooleanFlag("--offline");
  const useOai = parseBooleanFlag("--useOai=true");
  const retentionDays = Number(getArgValue("--retentionDays=", "730"));

  const [topics, rankingConfig, queryPackVersionMeta, queryPacks, applicationRegistry] = await Promise.all([
    loadJson(path.join(dataDir, "taxonomy", "topics.json")),
    loadJson(path.join(dataDir, "ranking", "config.json")),
    loadJson(path.join(dataDir, "editorial", "query-pack-version.json")).catch(() => ({ version: "" })),
    loadQueryPacks({ dataDir }),
    loadApplicationRegistry({ dataDir })
  ]);

  const harvestPlan = buildHarvestPlan(queryPacks);
  const seedPaperIds = collectSeedPaperIds(queryPacks);
  const referencedIds = Array.from(await extractArxivIds());
  const anchoredIds = topics.flatMap((topic) => topic.anchors ?? []);
  const canonicalIds = new Set([...seedPaperIds, ...referencedIds, ...anchoredIds]);

  let oaiIds = [];
  if (useOai && !offline) {
    const oai = await harvestOai({ dataDir });
    oaiIds = (oai.ids ?? []).slice(0, 120);
  }

  const [existingPapers, evidencePapers, harvested, seedPapers, oaiPapers] = await Promise.all([
    loadAllPapers(dataDir),
    ensureEvidence({ offline, harvestRunId: `evidence-${formatDate(new Date())}`, writeOutput: false }),
    fetchPlanEntries(harvestPlan, { offline }),
    hydratePaperIds(seedPaperIds, { offline, reason: "seed-papers" }),
    hydratePaperIds(oaiIds, { offline, reason: "oai-delta" })
  ]);

  const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const retainedExisting = existingPapers.filter((paper) => {
    if (canonicalIds.has(paper.arxiv_id)) return true;
    const submitted = new Date(paper.submitted_at ?? 0);
    return !Number.isNaN(submitted.getTime()) && submitted >= retentionCutoff;
  });

  const mergedCandidates = mergePaperList([
    ...retainedExisting,
    ...evidencePapers,
    ...seedPapers,
    ...oaiPapers,
    ...harvested
  ]);
  const tagged = tagTopics(mergedCandidates, topics, { rulesVersion: "v2" });
  const filtered = filterAndEnrichCorpus({
    papers: tagged,
    packs: queryPacks,
    registry: applicationRegistry,
    canonicalIds,
    retainedIds: canonicalIds
  });

  const momentum = computeTopicMomentum(filtered, topics, {
    windowA: rankingConfig.momentum_window_days,
    windowB: rankingConfig.baseline_window_days
  });
  const scored = scoreCorpusForRanking({
    papers: filtered,
    momentumByTopic: momentum.topics,
    canonicalIds
  });
  const trended = computeTrending(scored, momentum.topics, rankingConfig);

  if (!dryRun) {
    await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "metrics", "topic_momentum.json"),
      JSON.stringify(momentum, null, 2)
    );

    await writeSnapshots(trended, {
      dataDir,
      pruneToIds: trended.map((paper) => paper.arxiv_id)
    });

    await generateTopicFeeds({
      dataDir,
      papers: trended,
      topics,
      limitLatest: 12,
      limitTrending: 12
    });
    await generateApplicationFeeds({
      dataDir,
      windowDays,
      limitLatest: 12,
      limitTrending: 12,
      papers: trended
    });
    await generateNavigatorData({ dataDir });
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
    source: useOai && !offline ? "arxiv_api+oai" : "arxiv_api",
    dataset: offline ? "offline" : "prod",
    records,
    rankingConfigVersion: rankingConfig.version,
    queryPackVersion: queryPackVersionMeta.version || queryPacks[0]?.version || ""
  });

  console.log(`Pipeline complete. Papers: ${records}. Harvest tasks: ${harvestPlan.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
