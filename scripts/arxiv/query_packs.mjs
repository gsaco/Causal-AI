import fs from "node:fs/promises";
import path from "node:path";
import { QueryPack } from "./schema.mjs";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function loadQueryPacks({ dataDir = "data" } = {}) {
  const dir = path.join(dataDir, "arxiv", "query_packs");
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  const packs = [];

  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(dir, file), "utf-8"));
    const normalized = {
      id: raw.id ?? file.replace(/\.json$/, ""),
      enabled: raw.enabled ?? true,
      priority: raw.priority ?? 5,
      title: raw.title ?? raw.group,
      version: raw.version,
      group: raw.group,
      topics: raw.topics,
      candidate_queries:
        raw.candidate_queries ??
        toArray(raw.queries).map((query, index) => ({
          id: `${raw.id ?? file.replace(/\.json$/, "")}-candidate-${index + 1}`,
          query,
          max_results: raw.per_pack_cap,
          sort_by: "submittedDate",
          sort_order: "descending"
        })),
      precision_queries: raw.precision_queries ?? [],
      category_allowlist: raw.category_allowlist ?? [],
      required_keywords_any: raw.required_keywords_any ?? [],
      required_keywords_all: raw.required_keywords_all ?? [],
      exclude_keywords: raw.exclude_keywords ?? [],
      seed_papers: raw.seed_papers ?? [],
      per_pack_cap: raw.per_pack_cap
    };
    packs.push(QueryPack.parse(normalized));
  }

  return packs
    .filter((pack) => pack.enabled !== false)
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || a.id.localeCompare(b.id));
}

export function buildHarvestPlan(packs) {
  return packs.flatMap((pack) => {
    const queries = [...pack.candidate_queries, ...(pack.precision_queries ?? [])];
    return queries.map((query) => ({
      packId: pack.id,
      queryId: query.id,
      query: query.query,
      maxResults: Math.min(query.max_results ?? pack.per_pack_cap ?? 60, 200),
      sortBy: query.sort_by ?? "submittedDate",
      sortOrder: query.sort_order ?? "descending"
    }));
  });
}

export function collectSeedPaperIds(packs) {
  return Array.from(new Set(packs.flatMap((pack) => pack.seed_papers ?? [])));
}

export function normalizePaperText(paper) {
  return `${paper.title ?? ""} ${paper.abstract ?? ""}`.toLowerCase();
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function includesAll(text, keywords = []) {
  return keywords.every((keyword) => text.includes(String(keyword).toLowerCase()));
}

export function matchPackToPaper(paper, pack) {
  const text = normalizePaperText(paper);
  const categories = new Set(paper.categories ?? [paper.primary_category].filter(Boolean));
  const topicIds = new Set((paper.topic_tags ?? []).map((tag) => tag.topic_id));
  const queryPackIds = new Set(paper.provenance?.query_packs ?? []);

  const categoryPass =
    (pack.category_allowlist ?? []).length === 0 ||
    pack.category_allowlist.some((category) => categories.has(category));
  if (!categoryPass) return { matched: false, reason: "category" };

  if (includesAny(text, pack.exclude_keywords ?? [])) {
    return { matched: false, reason: "exclude-keyword" };
  }

  if (!includesAll(text, pack.required_keywords_all ?? [])) {
    return { matched: false, reason: "missing-required-all" };
  }

  const anyKeywordHit = includesAny(text, pack.required_keywords_any ?? []);
  const topicOverlap = pack.topics.filter((topicId) => topicIds.has(topicId));
  const queryPackHit = queryPackIds.has(pack.id);
  const seeded = (pack.seed_papers ?? []).includes(paper.arxiv_id);

  const passesAnyRequirement =
    (pack.required_keywords_any ?? []).length === 0 ? true : anyKeywordHit;

  const matched =
    passesAnyRequirement && (seeded || queryPackHit || topicOverlap.length > 0 || anyKeywordHit);

  return {
    matched,
    reason: matched ? "matched" : "no-signal",
    topicOverlap,
    keywordHit: anyKeywordHit,
    seeded,
    queryPackHit
  };
}
