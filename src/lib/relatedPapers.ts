type TopicTag = {
  topic_id: string;
};

export type PaperRecord = {
  arxiv_id: string;
  title?: string;
  submitted_at?: string;
  topic_tags?: TopicTag[];
  application_tags?: string[];
  primary_category?: string;
  provenance?: {
    query_packs?: string[];
  };
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

export function findRelatedPapers({
  paper,
  index,
  limit = 4
}: {
  paper: PaperRecord;
  index: PaperRecord[];
  limit?: number;
}): PaperRecord[] {
  const targetTopics = new Set((paper.topic_tags ?? []).map((tag) => tag.topic_id));
  const targetApplications = new Set(paper.application_tags ?? []);
  const targetPacks = new Set(paper.provenance?.query_packs ?? []);
  const targetTokens = new Set(tokenize(paper.title ?? ""));
  const targetDate = new Date(paper.submitted_at ?? 0).getTime();

  const scored = index
    .filter((item) => item.arxiv_id !== paper.arxiv_id)
    .map((item) => {
      const topicOverlap = (item.topic_tags ?? []).filter((tag) => targetTopics.has(tag.topic_id)).length;
      const applicationOverlap = (item.application_tags ?? []).filter((tag) => targetApplications.has(tag)).length;
      const packOverlap = (item.provenance?.query_packs ?? []).filter((pack) => targetPacks.has(pack)).length;
      const tokenOverlap = tokenize(item.title ?? "").filter((token) => targetTokens.has(token)).length;
      const categoryBoost = item.primary_category === paper.primary_category ? 0.5 : 0;
      const itemDate = new Date(item.submitted_at ?? 0).getTime();
      const temporalBoost =
        Number.isFinite(targetDate) && Number.isFinite(itemDate)
          ? Math.max(0, 1 - Math.abs(targetDate - itemDate) / (1000 * 60 * 60 * 24 * 365 * 3))
          : 0;
      const score =
        topicOverlap * 2.2 +
        applicationOverlap * 1.2 +
        packOverlap * 1.8 +
        tokenOverlap +
        categoryBoost +
        temporalBoost * 0.8;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);

  return scored;
}
