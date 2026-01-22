# Causal-AI

Causal-AI is a static-first Astro site for a researcher-trusted causal AI field guide. The site is designed for GitHub Pages deployment with scheduled arXiv snapshot refreshes.

## Quick start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment

GitHub Pages deployment uses a custom Actions workflow (`.github/workflows/deploy.yml`). The site is configured with:

- `site: https://gsaco.github.io`
- `base: /Causal-AI`

## Data

Snapshots live under `data/`:

- `data/papers.index.json`
- `data/papers/<arxiv_id>.json`
- `data/topic_feeds/<topic>.json`
- `data/metrics/*`
- `data/provenance/*`

The current dataset is a demo placeholder until arXiv ingestion is wired.
