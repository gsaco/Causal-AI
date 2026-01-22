# Causal AI Futures

Causal AI Futures is a static-first field guide to the intervention era. It tracks causal AI research with evidence-first claims, transparent provenance, and reproducible ranking logic. The site is designed for GitHub Pages with scheduled snapshots, so the content stays fresh without a server.

## Mission

Make causal AI understandable, navigable, and honest. Every claim is grounded in arXiv IDs, every tendency is reproducible, and every page points back to primary sources.

## How the site stays fresh

- **Scheduled snapshots**: Weekday arXiv refreshes run via GitHub Actions (`update_arxiv.yml`).
- **Weekly digest**: A Monday digest workflow compiles notable updates (`generate_digest.yml`).
- **Provenance logs**: Each build writes a harvest window, query pack version, and update log entries.

## Trust guarantees

- **Claims require evidence**: `<Claim>` blocks must include arXiv IDs; CI enforces this.
- **Trend evidence minimums**: Tendencies require foundational, new-wave, and debate anchors.
- **Coverage gates**: Citation coverage is computed per section and must meet thresholds.
- **Transparent ranking**: Ranking weights and windows are published in `data/ranking/config.json`.

## Quick start

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Validation

```bash
node scripts/validate/validate_schema.mjs
node scripts/validate/validate_citations.mjs
node scripts/validate/validate_links.mjs
node scripts/validate/compute_coverage.mjs
```

## Data layout

- `data/papers.index.json` - normalized arXiv metadata
- `data/papers/<arxiv_id>.json` - per-paper snapshots
- `data/topic_feeds/<topic>.json` - latest + trending per topic
- `data/applications/<slug>.json` - application-specific feeds
- `data/metrics/*` - momentum, radar, coverage, clusters
- `data/provenance/*` - build metadata + update logs
- `data/atlas/graph.json` - Atlas graph data

## Contributing

See `CONTRIBUTING.md` for how to add topics, tendencies, applications, and claims.

## License

Content is released under CC BY 4.0 (see `LICENSE`).
