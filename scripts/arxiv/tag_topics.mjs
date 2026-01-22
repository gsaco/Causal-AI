function normalizeText(value) {
  return (value ?? "").toLowerCase();
}

function findMatches(text, keywords = []) {
  const matches = [];
  for (const keyword of keywords) {
    if (!keyword) continue;
    const needle = keyword.toLowerCase();
    if (text.includes(needle)) matches.push(keyword);
  }
  return matches;
}

export function tagPaper(paper, topics, { rulesVersion = "v1" } = {}) {
  const text = `${paper.title ?? ""} ${paper.abstract ?? ""}`.toLowerCase();
  const tags = [];

  for (const topic of topics) {
    const anyKeywords = topic.keywords_any ?? [];
    const allKeywords = topic.keywords_all ?? [];
    const excludeKeywords = topic.exclude_keywords ?? [];

    const matchedAny = findMatches(text, anyKeywords);
    const matchedAll = findMatches(text, allKeywords);
    const hasAllRequired = allKeywords.length === 0 || matchedAll.length === allKeywords.length;
    const hasAny = anyKeywords.length === 0 || matchedAny.length > 0;
    const hasExcluded = findMatches(text, excludeKeywords).length > 0;
    const categoryBoost =
      topic.category_whitelist?.includes(paper.primary_category) ?? false;

    if (hasExcluded) continue;
    if (!hasAllRequired || !hasAny) continue;
    if (matchedAny.length === 0 && matchedAll.length === 0 && !categoryBoost) continue;

    const matchedKeywords = Array.from(new Set([...matchedAny, ...matchedAll]));
    const base = 0.5 + matchedKeywords.length * 0.08 + (categoryBoost ? 0.15 : 0);
    const confidence = Math.min(1, Number(base.toFixed(2)));

    tags.push({
      topic_id: topic.id,
      confidence,
      rationale: {
        matched_keywords: matchedKeywords,
        rules_version: rulesVersion
      }
    });
  }

  return tags.sort((a, b) => b.confidence - a.confidence);
}

export function tagTopics(papers, topics, { rulesVersion = "v1" } = {}) {
  return papers.map((paper) => ({
    ...paper,
    topic_tags: tagPaper(paper, topics, { rulesVersion })
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("tag_topics.mjs is a library module. Use from run.mjs.");
}
