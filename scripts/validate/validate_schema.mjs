import fs from "node:fs/promises";
import path from "node:path";
import {
  AnchorList,
  ApplicationFeed,
  AtlasGraph,
  BuildProvenance,
  EmergingClusters,
  MetricsCitationCoverage,
  MetricsCrosslistHeatmap,
  MetricsTopicMomentum,
  MetricsTopicTimeseries,
  MetricsTrendRadar,
  MetricsVersionChurn,
  OaiState,
  Paper,
  PaperIndexEntry,
  PaperTrails,
  QueryPack,
  RankingConfig,
  TopicFeed,
  TopicTaxonomy
} from "../arxiv/schema.mjs";

const dataDir = path.resolve("data");

async function listJsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_raw") continue;
      files.push(...(await listJsonFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function getSchemaForPath(relativePath) {
  if (relativePath === "papers.index.json") return PaperIndexEntry.array();
  if (relativePath.startsWith("papers/")) return Paper;
  if (relativePath === "taxonomy/topics.json") return TopicTaxonomy.array();
  if (relativePath === "taxonomy/anchors.json") return AnchorList;
  if (relativePath.startsWith("topic_feeds/")) return TopicFeed;
  if (relativePath.startsWith("applications/") && !relativePath.endsWith("registry.json")) return ApplicationFeed;
  if (relativePath === "atlas/graph.json") return AtlasGraph;
  if (relativePath === "metrics/emerging_clusters.json") return EmergingClusters;
  if (relativePath.startsWith("arxiv/query_packs/")) return QueryPack;
  if (relativePath === "provenance/build.json") return BuildProvenance;
  if (relativePath === "metrics/topic_momentum.json") return MetricsTopicMomentum;
  if (relativePath === "metrics/topic_timeseries.json") return MetricsTopicTimeseries;
  if (relativePath === "metrics/trend_radar.json") return MetricsTrendRadar;
  if (relativePath === "metrics/crosslist_heatmap.json") return MetricsCrosslistHeatmap;
  if (relativePath === "metrics/version_churn.json") return MetricsVersionChurn;
  if (relativePath === "metrics/citation_coverage.json") return MetricsCitationCoverage;
  if (relativePath === "ranking/config.json") return RankingConfig;
  if (relativePath === "curation/paper_trails.json") return PaperTrails;
  if (relativePath === "provenance/oai_state.json") return OaiState;
  return null;
}

function formatZodError(error) {
  return error.errors
    .map((issue) => {
      const pathLabel = issue.path.length ? issue.path.join(".") : "(root)";
      return `  - ${pathLabel}: ${issue.message}`;
    })
    .join("\n");
}

export async function validateSchema() {
  const files = await listJsonFiles(dataDir);
  const errors = [];

  for (const filePath of files) {
    const relativePath = path.relative(dataDir, filePath).replace(/\\/g, "/");
    const schema = getSchemaForPath(relativePath);
    if (!schema) continue;
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    const result = schema.safeParse(data);
    if (!result.success) {
      errors.push({
        file: relativePath,
        message: formatZodError(result.error)
      });
    }
  }

  if (errors.length > 0) {
    console.error("Schema validation failed:");
    for (const error of errors) {
      console.error(`- ${error.file}`);
      console.error(error.message);
    }
    process.exit(1);
  }

  console.log("Schema validation passed.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateSchema().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
