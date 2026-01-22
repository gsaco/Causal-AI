function formatAuthors(authors = []) {
  const names = authors.map((author) => (typeof author === "string" ? author : author.name ?? ""));
  return names.filter(Boolean).join(" and ");
}

function escapeField(value) {
  return value.replace(/[{}]/g, "");
}

export function toBibTex(paper) {
  const year = paper.submitted_at?.slice(0, 4) ?? "";
  const key = `arxiv:${paper.arxiv_id}`;
  return `@article{${key},\n` +
    `  title={${escapeField(paper.title)}},\n` +
    `  author={${escapeField(formatAuthors(paper.authors ?? []))}},\n` +
    `  year={${year}},\n` +
    `  eprint={${paper.arxiv_id}},\n` +
    `  archivePrefix={arXiv},\n` +
    `  primaryClass={${paper.primary_category ?? ""}}\n` +
    `}`;
}
