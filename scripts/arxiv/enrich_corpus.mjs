import fs from "node:fs/promises";
import path from "node:path";
import { matchPackToPaper, normalizePaperText } from "./query_packs.mjs";

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function recencyScore(dateValue, referenceDate, halfLifeDays) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  const diffMs = referenceDate.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const decay = Math.exp((-Math.log(2) * diffDays) / halfLifeDays);
  return Number.isFinite(decay) ? decay : 0;
}

export async function loadApplicationRegistry({ dataDir = "data" } = {}) {
  const raw = await fs.readFile(path.join(dataDir, "applications", "registry.json"), "utf-8");
  return JSON.parse(raw);
}

export function tagApplications(papers, registry = []) {
  return papers.map((paper) => {
    const text = normalizePaperText(paper);
    const paperTopics = new Set((paper.topic_tags ?? []).map((tag) => tag.topic_id));
    const categories = new Set(paper.categories ?? [paper.primary_category].filter(Boolean));

    const applicationTags = registry
      .filter((entry) => {
        const topicOverlap = (entry.topics ?? []).some((topicId) => paperTopics.has(topicId));
        const keywordHit = includesAny(text, entry.keywords_any ?? []);
        const categoryPass =
          (entry.category_allowlist ?? []).length === 0 ||
          (entry.category_allowlist ?? []).some((category) => categories.has(category));
        return categoryPass && keywordHit && (topicOverlap || keywordHit);
      })
      .map((entry) => entry.slug);

    return {
      ...paper,
      application_tags: uniq(applicationTags)
    };
  });
}

export function filterAndEnrichCorpus({
  papers,
  packs,
  registry = [],
  canonicalIds = [],
  retainedIds = [],
  referenceDate = new Date()
}) {
  const canonicalSet = canonicalIds instanceof Set ? canonicalIds : new Set(canonicalIds);
  const retainedSet = retainedIds instanceof Set ? retainedIds : new Set(retainedIds);
  const withApplications = tagApplications(papers, registry);

  return withApplications
    .map((paper) => {
      const packMatches = packs
        .map((pack) => ({ pack, match: matchPackToPaper(paper, pack) }))
        .filter((entry) => entry.match.matched);
      const packIds = uniq([
        ...(paper.provenance?.query_packs ?? []),
        ...packMatches.map((entry) => entry.pack.id)
      ]);
      const maxTopicConfidence = Number(
        Math.max(0, ...(paper.topic_tags ?? []).map((tag) => Number(tag.confidence ?? 0))).toFixed(4)
      );
      const recentScore = Number(
        (
          recencyScore(paper.submitted_at, referenceDate, 21) * 0.55 +
          recencyScore(paper.updated_at, referenceDate, 30) * 0.45
        ).toFixed(4)
      );
      const seeded = canonicalSet.has(paper.arxiv_id);
      const breadth = Math.min(1, ((paper.topic_tags ?? []).length + packIds.length) / 6);
      const canonicalScore = Number((seeded ? 1 : breadth * 0.55 + maxTopicConfidence * 0.45).toFixed(4));
      const topicGate = maxTopicConfidence >= 0.58 || seeded;
      const packGate = packIds.length > 0;
      const keep = retainedSet.has(paper.arxiv_id) || packGate || topicGate;

      return {
        ...paper,
        application_tags: paper.application_tags ?? [],
        provenance: {
          ...paper.provenance,
          query_packs: packIds
        },
        metrics: {
          ...paper.metrics,
          recent_score: recentScore,
          canonical_score: canonicalScore,
          max_topic_confidence: maxTopicConfidence
        },
        _eligible: keep
      };
    })
    .filter((paper) => paper._eligible)
    .map(({ _eligible, ...paper }) => paper);
}

export function scoreCorpusForRanking({
  papers,
  momentumByTopic = {},
  canonicalIds = [],
  referenceDate = new Date(),
  recencyWeight = 0.45,
  momentumWeight = 0.25,
  crossListWeight = 0.15,
  churnWeight = 0.15
}) {
  const canonicalSet = canonicalIds instanceof Set ? canonicalIds : new Set(canonicalIds);
  return papers.map((paper) => {
    const updatedRecency = recencyScore(paper.updated_at, referenceDate, 30);
    const topicMomentum = (paper.topic_tags ?? [])
      .map((tag) => momentumByTopic[tag.topic_id] ?? 0)
      .reduce((sum, value, _, arr) => sum + value / (arr.length || 1), 0);
    const crossList = Math.min(1, (paper.metrics?.cross_list_count ?? 0) / 3);
    const versionCount = paper.metrics?.version_count ?? 1;
    const churn = Math.min(1, Math.max(0, (versionCount - 1) / 3)) * updatedRecency;
    const recentScore = paper.metrics?.recent_score ?? 0;
    const canonicalScore =
      paper.metrics?.canonical_score ?? (canonicalSet.has(paper.arxiv_id) ? 1 : 0);
    const risingScore = Number(
      (
        recencyWeight * recentScore +
        momentumWeight * topicMomentum +
        crossListWeight * crossList +
        churnWeight * churn
      ).toFixed(4)
    );

    return {
      ...paper,
      metrics: {
        ...paper.metrics,
        recent_score: recentScore,
        rising_score: risingScore,
        canonical_score: Number(canonicalScore.toFixed(4)),
        max_topic_confidence: paper.metrics?.max_topic_confidence ?? 0
      }
    };
  });
}
