import fs from "node:fs/promises";
import path from "node:path";

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function excerpt(text, limit = 220) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function sortByMetric(metric) {
  return (a, b) => (b.metrics?.[metric] ?? 0) - (a.metrics?.[metric] ?? 0);
}

function sortByDate(field) {
  return (a, b) => new Date(b[field] ?? 0).getTime() - new Date(a[field] ?? 0).getTime();
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function chunk(items, size) {
  const pages = {};
  for (let index = 0; index < items.length; index += size) {
    pages[String(index / size + 1)] = items.slice(index, index + size);
  }
  return pages;
}

export async function generateNavigatorData({ dataDir = "data", pageSize = 24 } = {}) {
  const [papers, topics] = await Promise.all([
    JSON.parse(await fs.readFile(path.join(dataDir, "papers.index.json"), "utf-8")),
    JSON.parse(await fs.readFile(path.join(dataDir, "taxonomy", "topics.json"), "utf-8"))
  ]);
  const groupByTopic = new Map(topics.map((topic) => [topic.id, topic.group]));
  const generatedAt = new Date().toISOString().slice(0, 10);
  const navigatorDir = path.join(dataDir, "navigator");
  await fs.mkdir(navigatorDir, { recursive: true });

  const catalog = papers.map((paper) => {
    const topicIds = (paper.topic_tags ?? []).map((tag) => tag.topic_id);
    const groups = uniq(topicIds.map((topicId) => groupByTopic.get(topicId)));
    return {
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      abstract_preview: excerpt(paper.abstract, 220),
      authors: (paper.authors ?? []).slice(0, 6),
      submitted_at: paper.submitted_at,
      updated_at: paper.updated_at,
      primary_category: paper.primary_category,
      categories: paper.categories ?? [],
      topic_ids: topicIds,
      groups,
      application_tags: paper.application_tags ?? [],
      metrics: paper.metrics ?? {},
      links: {
        paper: `/papers/${paper.arxiv_id}`,
        arxiv_abs: paper.links?.arxiv_abs,
        arxiv_pdf: paper.links?.arxiv_pdf
      }
    };
  });

  const lensIds = {
    latest: [...papers].sort(sortByDate("submitted_at")).map((paper) => paper.arxiv_id),
    rising: [...papers].sort(sortByMetric("rising_score")).map((paper) => paper.arxiv_id),
    canonical: [...papers].sort(sortByMetric("canonical_score")).map((paper) => paper.arxiv_id)
  };
  const mixed = uniq(
    lensIds.canonical.slice(0, 18).flatMap((id, index) => [id, lensIds.rising[index], lensIds.latest[index]])
  ).slice(0, 18);

  const facets = {
    generated_at: generatedAt,
    counts: {
      papers: catalog.length,
      topics: countBy(catalog.flatMap((item) => item.topic_ids)),
      groups: countBy(catalog.flatMap((item) => item.groups)),
      applications: countBy(catalog.flatMap((item) => item.application_tags)),
      years: countBy(catalog.map((item) => String(item.submitted_at ?? "").slice(0, 4)).filter(Boolean)),
      categories: countBy(catalog.flatMap((item) => item.categories))
    }
  };

  const pages = {
    generated_at: generatedAt,
    page_size: pageSize,
    lenses: Object.fromEntries(
      Object.entries(lensIds).map(([lens, ids]) => [lens, chunk(ids, pageSize)])
    )
  };

  await Promise.all([
    fs.writeFile(path.join(navigatorDir, "catalog.json"), JSON.stringify(catalog, null, 2)),
    fs.writeFile(
      path.join(navigatorDir, "lenses.json"),
      JSON.stringify({ generated_at: generatedAt, lenses: lensIds }, null, 2)
    ),
    fs.writeFile(path.join(navigatorDir, "facets.json"), JSON.stringify(facets, null, 2)),
    fs.writeFile(path.join(navigatorDir, "pages.json"), JSON.stringify(pages, null, 2)),
    fs.writeFile(
      path.join(navigatorDir, "featured.json"),
      JSON.stringify(
        {
          generated_at: generatedAt,
          featured: {
            mixed,
            canonical: lensIds.canonical.slice(0, 12),
            rising: lensIds.rising.slice(0, 12),
            latest: lensIds.latest.slice(0, 12)
          }
        },
        null,
        2
      )
    )
  ]);

  return { catalog, facets, lenses: lensIds, pages, mixed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateNavigatorData().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
