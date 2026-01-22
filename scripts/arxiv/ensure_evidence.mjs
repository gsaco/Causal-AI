import fs from "node:fs/promises";
import path from "node:path";
import { extractArxivIds } from "../validate/extract_arxiv_ids.mjs";
import { fetchAllByQuery } from "./arxiv_atom.mjs";
import { normalizeEntry } from "./normalize.mjs";
import { writeSnapshots } from "./write_snapshots.mjs";

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadExistingIds() {
  const dir = path.join("data", "papers");
  const ids = new Set();
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      ids.add(file.replace(/\.json$/, ""));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return ids;
}

export async function ensureEvidence({ offline = false, harvestRunId = "evidence" } = {}) {
  const referenced = await extractArxivIds();
  const existing = await loadExistingIds();
  const missing = Array.from(referenced).filter((id) => !existing.has(id));
  if (missing.length === 0) {
    console.log("ensure_evidence: no missing IDs");
    return [];
  }

  if (offline) {
    console.warn(`ensure_evidence: offline mode, missing ${missing.length} IDs`);
    return [];
  }

  const harvestedAt = new Date().toISOString();
  const normalized = [];
  const chunks = chunkArray(missing, 25);

  for (const chunk of chunks) {
    const id_list = chunk.join(",");
    const entries = await fetchAllByQuery({ id_list, max_results: chunk.length });
    for (const entry of entries) {
      normalized.push(
        normalizeEntry(entry, {
          query: `id_list:${id_list}`,
          harvestedAt,
          harvestRunId
        })
      );
    }
  }

  await writeSnapshots(normalized);
  console.log(`ensure_evidence: fetched ${normalized.length} records`);
  return normalized;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const offline = process.argv.includes("--offline");
  ensureEvidence({ offline }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
