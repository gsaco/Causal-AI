function normalizeWhitespace(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function toDateString(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function normalizeEntry(entry, { query, harvestedAt, harvestRunId } = {}) {
  const submitted = toDateString(entry.published);
  const updated = toDateString(entry.updated || entry.published);
  const categories = entry.categories?.length ? entry.categories : [entry.primary_category].filter(Boolean);
  const versions = (entry.versions ?? []).map((version) => ({
    version: version.version,
    updated_at: toDateString(version.updated_at)
  }));
  const versionCount = versions.length > 0 ? versions.length : 1;

  return {
    arxiv_id: entry.arxiv_id,
    canonical_url: entry.links.abs ?? `https://arxiv.org/abs/${entry.arxiv_id}`,
    pdf_url: entry.links.pdf ?? `https://arxiv.org/pdf/${entry.arxiv_id}.pdf`,
    title: normalizeWhitespace(entry.title),
    abstract: normalizeWhitespace(entry.summary),
    authors: entry.authors ?? [],
    submitted_at: submitted,
    updated_at: updated || submitted,
    primary_category: entry.primary_category ?? categories[0] ?? "",
    categories,
    metrics: {
      cross_list_count: Math.max(0, categories.length - 1),
      version_count: versionCount,
      trending_score: entry.metrics?.trending_score ?? 0
    },
    topic_tags: entry.topic_tags ?? [],
    versions: versions.length > 0 ? versions : [{ version: "v1", updated_at: updated || submitted }],
    links: {
      arxiv_abs: entry.links.abs ?? `https://arxiv.org/abs/${entry.arxiv_id}`,
      arxiv_pdf: entry.links.pdf ?? `https://arxiv.org/pdf/${entry.arxiv_id}.pdf`
    },
    provenance: {
      source: "arxiv_api",
      harvested_at: harvestedAt ?? new Date().toISOString(),
      harvest_run_id: harvestRunId ?? "manual",
      queries: query ? [query] : []
    }
  };
}
