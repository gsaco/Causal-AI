import fs from "node:fs/promises";
import path from "node:path";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export async function writeProvenance({
  dataDir = "data",
  harvestWindow = "",
  source = "arxiv_api",
  dataset = "prod",
  records = 0,
  status = "ok",
  rankingConfigVersion = "",
  queryPackVersion = "",
  commit = process.env.GITHUB_SHA ?? "local"
} = {}) {
  const now = new Date();
  const snapshot = formatDate(now);
  const updatedAt = now.toISOString();

  const build = {
    snapshot,
    harvest_window: harvestWindow,
    source,
    updated_at: updatedAt,
    dataset,
    commit,
    ranking_config_version: rankingConfigVersion || undefined,
    query_pack_version: queryPackVersion || undefined
  };

  const buildPath = path.join(dataDir, "provenance", "build.json");
  await fs.mkdir(path.dirname(buildPath), { recursive: true });
  await fs.writeFile(buildPath, JSON.stringify(build, null, 2));

  const updateEntry = {
    snapshot,
    harvest_window: harvestWindow,
    records,
    status,
    updated_at: updatedAt,
    ranking_config_version: rankingConfigVersion || undefined,
    query_pack_version: queryPackVersion || undefined
  };

  const logPath = path.join(dataDir, "provenance", "update-log.ndjson");
  const line = `${JSON.stringify(updateEntry)}\n`;
  await fs.appendFile(logPath, line);

  return { build, updateEntry };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeProvenance().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
