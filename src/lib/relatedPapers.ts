function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
}

export function findRelatedPapers({ paper, index, limit = 4 }) {
  const targetTopics = new Set((paper.topic_tags ?? []).map((tag) => tag.topic_id));
  const targetTokens = new Set(tokenize(paper.title ?? ""));

  const scored = index
    .filter((item) => item.arxiv_id !== paper.arxiv_id)
    .map((item) => {
      const topicOverlap = (item.topic_tags ?? []).filter((tag) => targetTopics.has(tag.topic_id)).length;
      const tokenOverlap = tokenize(item.title ?? "").filter((token) => targetTokens.has(token)).length;
      const categoryBoost = item.primary_category === paper.primary_category ? 0.5 : 0;
      const score = topicOverlap * 2 + tokenOverlap + categoryBoost;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);

  return scored;
}
