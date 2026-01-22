# Contributing

Thanks for improving Causal AI Futures. This repo is evidence-first and arXiv-grounded. If you're adding or editing content, please follow the rules below so CI passes and trust stays intact.

## Ground rules

- Every `<Claim>` block must include an `evidence` array of arXiv IDs.
- Tendencies require `foundational >= 2`, `new_wave >= 2`, and `debates >= 1` IDs in frontmatter.
- Applications and frontiers must include at least 6 evidence IDs across frontmatter + claims.
- Avoid hype. Use cautious language ("signals", "open questions", "evidence suggests").

## Adding topics

1. Edit `data/taxonomy/topics.json` to add the topic entry (id, title, group, scope, anchors, query, keywords).
2. Run the scaffold script to generate missing topic MDX:

   ```bash
   node scripts/content/scaffold_topics.mjs
   ```

3. Fill in the MDX under `src/content/topics/<id>.mdx` with evidence-backed claims.
4. Ensure any new arXiv IDs are included in `data/taxonomy/anchors.json` or added to `data/papers/`.
5. Validate:

   ```bash
   node scripts/arxiv/ensure_evidence.mjs
   node scripts/validate/validate_citations.mjs
   ```

## Adding tendencies

- Create a new MDX file under `src/content/trends/` with required frontmatter and claims.
- Add evidence IDs to frontmatter lists (`foundational`, `new_wave`, `debates`).

## Adding applications or frontiers

- Add a new MDX file under `src/content/applications/` or `src/content/frontiers/`.
- Include 6+ evidence IDs across frontmatter + claims.
- Update any relevant registry data (queries) under `data/applications/registry.json`.

## Running the full suite

```bash
npm run build
npm run lint:all
npm test
```

## Style

- Keep paragraphs short.
- Favor concrete, reproducible claims over opinions.
- Label non-arXiv links as "non-arXiv supporting source."
