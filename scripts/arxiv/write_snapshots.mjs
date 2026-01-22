import fs from "node:fs/promises";
import path from "node:path";

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeVersion(version) {
  return {
    version: version.version,
    updated_at: version.updated_at
  };
}

export function mergePaperRecords(existing, incoming) {
  if (!existing) return incoming;

  const existingUpdated = toDate(existing.updated_at);
  const incomingUpdated = toDate(incoming.updated_at);
  const incomingIsNewer =
    !existingUpdated || (incomingUpdated && incomingUpdated.getTime() > existingUpdated.getTime());

  const categories = unique([...(existing.categories ?? []), ...(incoming.categories ?? [])]);
  const versionsMap = new Map();
  for (const version of existing.versions ?? []) {
    versionsMap.set(version.version, normalizeVersion(version));
  }
  for (const version of incoming.versions ?? []) {
    const current = versionsMap.get(version.version);
    if (!current) {
      versionsMap.set(version.version, normalizeVersion(version));
      continue;
    }
    const currentDate = toDate(current.updated_at);
    const nextDate = toDate(version.updated_at);
    if (nextDate && (!currentDate || nextDate.getTime() > currentDate.getTime())) {
      versionsMap.set(version.version, normalizeVersion(version));
    }
  }
  const versions = Array.from(versionsMap.values()).sort((a, b) => {
    return (a.version ?? "").localeCompare(b.version ?? "");
  });

  const merged = {
    ...existing,
    ...incoming,
    title: incomingIsNewer ? incoming.title : existing.title,
    abstract: incomingIsNewer ? incoming.abstract : existing.abstract,
    authors: incomingIsNewer ? incoming.authors : existing.authors,
    updated_at: incomingIsNewer ? incoming.updated_at : existing.updated_at,
    submitted_at: existing.submitted_at ?? incoming.submitted_at,
    categories,
    metrics: {
      ...(existing.metrics ?? {}),
      ...(incoming.metrics ?? {}),
      cross_list_count: Math.max(0, categories.length - 1),
      version_count: versions.length || incoming.metrics?.version_count || 1,
      trending_score: incoming.metrics?.trending_score ?? existing.metrics?.trending_score ?? 0
    },
    topic_tags: incoming.topic_tags?.length ? incoming.topic_tags : existing.topic_tags ?? [],
    versions,
    links: incoming.links ?? existing.links,
    canonical_url: incoming.canonical_url ?? existing.canonical_url,
    pdf_url: incoming.pdf_url ?? existing.pdf_url,
    provenance: {
      ...existing.provenance,
      ...incoming.provenance,
      queries: unique([
        ...(existing.provenance?.queries ?? []),
        ...(incoming.provenance?.queries ?? [])
      ])
    }
  };

  return merged;
}

async function loadExistingPapers(papersDir) {
  const map = new Map();
  try {
    const files = await fs.readdir(papersDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(papersDir, file), "utf-8");
      const data = JSON.parse(raw);
      map.set(data.arxiv_id, data);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return map;
}

function buildIndexEntry(paper) {
  return {
    arxiv_id: paper.arxiv_id,
    title: paper.title,
    abstract: paper.abstract,
    authors: paper.authors.map((author) => author.name ?? author),
    submitted_at: paper.submitted_at,
    updated_at: paper.updated_at,
    primary_category: paper.primary_category,
    categories: paper.categories,
    topic_tags: paper.topic_tags ?? [],
    metrics: paper.metrics,
    links: paper.links,
    provenance: paper.provenance
  };
}

export async function writeSnapshots(normalizedPapers, { dataDir = "data" } = {}) {
  const papersDir = path.join(dataDir, "papers");
  await fs.mkdir(papersDir, { recursive: true });
  const existingMap = await loadExistingPapers(papersDir);

  for (const paper of normalizedPapers) {
    const merged = mergePaperRecords(existingMap.get(paper.arxiv_id), paper);
    existingMap.set(paper.arxiv_id, merged);
  }

  const papers = Array.from(existingMap.values()).sort((a, b) => {
    const aTime = new Date(a.updated_at).getTime();
    const bTime = new Date(b.updated_at).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return a.arxiv_id.localeCompare(b.arxiv_id);
    return bTime - aTime;
  });

  for (const paper of papers) {
    const filePath = path.join(papersDir, `${paper.arxiv_id}.json`);
    await fs.writeFile(filePath, JSON.stringify(paper, null, 2));
  }

  const index = papers.map(buildIndexEntry);
  const indexPath = path.join(dataDir, "papers.index.json");
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  return { papers, index };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("write_snapshots.mjs is a library module. Use from run.mjs.");
}
