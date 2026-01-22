import test from "node:test";
import assert from "node:assert/strict";
import { mergePaperRecords } from "../scripts/arxiv/write_snapshots.mjs";

test("merge snapshots preserves versions", () => {
  const existing = {
    arxiv_id: "1234.56789",
    title: "Old",
    abstract: "Old",
    authors: [{ name: "A" }],
    submitted_at: "2024-01-01",
    updated_at: "2024-01-10",
    primary_category: "cs.LG",
    categories: ["cs.LG"],
    metrics: { cross_list_count: 0, version_count: 1, trending_score: 0.1 },
    topic_tags: [],
    versions: [{ version: "v1", updated_at: "2024-01-01" }],
    links: { arxiv_abs: "https://arxiv.org/abs/1234.56789", arxiv_pdf: "https://arxiv.org/pdf/1234.56789.pdf" },
    canonical_url: "https://arxiv.org/abs/1234.56789",
    pdf_url: "https://arxiv.org/pdf/1234.56789.pdf",
    provenance: { source: "arxiv_api", harvested_at: "2024-01-10T00:00:00Z", harvest_run_id: "x" }
  };
  const incoming = {
    ...existing,
    updated_at: "2024-02-01",
    versions: [
      { version: "v1", updated_at: "2024-01-01" },
      { version: "v2", updated_at: "2024-02-01" }
    ]
  };
  const merged = mergePaperRecords(existing, incoming);
  assert.equal(merged.metrics.version_count, 2);
  assert.ok(merged.versions.find((v) => v.version === "v2"));
});
