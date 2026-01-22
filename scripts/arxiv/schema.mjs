import { z } from "zod";

const arxivIdRegex = /^(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const ArxivId = z.string().regex(arxivIdRegex, "Invalid arXiv id");
export const DateString = z.string().regex(dateRegex, "Expected YYYY-MM-DD");
export const DateTimeString = z.string();

export const Author = z.object({
  name: z.string()
});

export const TopicTag = z.object({
  topic_id: z.string(),
  confidence: z.number(),
  rationale: z
    .object({
      matched_keywords: z.array(z.string()).optional(),
      rules_version: z.string().optional()
    })
    .optional()
});

export const Paper = z.object({
  arxiv_id: ArxivId,
  canonical_url: z.string().url(),
  pdf_url: z.string().url(),
  title: z.string(),
  abstract: z.string(),
  authors: z.array(Author),
  submitted_at: DateString,
  updated_at: DateString,
  primary_category: z.string(),
  categories: z.array(z.string()),
  metrics: z
    .object({
      cross_list_count: z.number().int().nonnegative(),
      version_count: z.number().int().positive(),
      trending_score: z.number().optional()
    })
    .passthrough(),
  topic_tags: z.array(TopicTag).optional(),
  versions: z
    .array(
      z.object({
        version: z.string(),
        updated_at: DateString
      })
    )
    .optional(),
  links: z.object({
    arxiv_abs: z.string().url(),
    arxiv_pdf: z.string().url()
  }),
  provenance: z.object({
    source: z.string(),
    harvested_at: DateTimeString,
    harvest_run_id: z.string(),
    queries: z.array(z.string()).optional()
  })
});

export const PaperIndexEntry = z.object({
  arxiv_id: ArxivId,
  title: z.string(),
  abstract: z.string(),
  authors: z.array(z.string()),
  submitted_at: DateString,
  updated_at: DateString,
  primary_category: z.string(),
  categories: z.array(z.string()),
  topic_tags: z.array(TopicTag).optional(),
  metrics: z
    .object({
      cross_list_count: z.number().int().nonnegative(),
      version_count: z.number().int().positive(),
      trending_score: z.number().optional()
    })
    .passthrough(),
  links: z.object({
    arxiv_abs: z.string().url(),
    arxiv_pdf: z.string().url()
  }),
  provenance: z.object({
    source: z.string(),
    harvested_at: DateTimeString,
    harvest_run_id: z.string(),
    queries: z.array(z.string()).optional()
  })
});

export const TopicTaxonomy = z.object({
  id: z.string(),
  title: z.string(),
  scope: z.string(),
  group: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  anchors: z.array(ArxivId),
  query: z.string().optional(),
  keywords_any: z.array(z.string()).optional(),
  keywords_all: z.array(z.string()).optional(),
  exclude_keywords: z.array(z.string()).optional(),
  category_whitelist: z.array(z.string()).optional()
});

export const TopicFeed = z.object({
  topic: z.string(),
  generated_at: DateString.optional(),
  latest: z.array(ArxivId),
  trending: z.array(ArxivId)
});

export const BuildProvenance = z.object({
  snapshot: DateString,
  harvest_window: z.string(),
  source: z.string(),
  updated_at: DateTimeString,
  dataset: z.string(),
  commit: z.string().optional(),
  ranking_config_version: z.string().optional(),
  query_pack_version: z.string().optional()
});

export const UpdateLogEntry = z.object({
  snapshot: DateString,
  harvest_window: z.string(),
  records: z.number().int().nonnegative(),
  status: z.string(),
  updated_at: DateTimeString,
  ranking_config_version: z.string().optional(),
  query_pack_version: z.string().optional()
});

export const MetricsTopicMomentum = z.object({
  generated_at: DateString,
  window: z.object({
    A: z.string(),
    B: z.string()
  }),
  topics: z.record(z.number())
});

export const MetricsTopicTimeseries = z.object({
  generated_at: DateString,
  weeks: z.array(z.string()),
  topics: z.record(z.array(z.number()))
});

export const MetricsTrendRadar = z.object({
  generated_at: DateString,
  topics: z.record(
    z.object({
      momentum: z.number(),
      recency_share: z.number(),
      cross_list_breadth: z.number(),
      revision_churn: z.number()
    })
  )
});

export const MetricsCrosslistHeatmap = z.object({
  generated_at: DateString,
  window: z.string(),
  categories: z.array(z.string()),
  matrix: z.record(z.record(z.number()))
});

export const MetricsVersionChurn = z.object({
  generated_at: DateString,
  window: z.string(),
  papers: z.array(
    z.object({
      arxiv_id: ArxivId,
      title: z.string(),
      updated_at: DateString,
      version_count: z.number().int().positive(),
      primary_category: z.string(),
      links: z
        .object({
          arxiv_abs: z.string().url(),
          arxiv_pdf: z.string().url()
        })
        .optional()
    })
  )
});

export const MetricsCitationCoverage = z.object({
  generated_at: DateString,
  overall: z.object({
    claims: z.number().int().nonnegative(),
    with_evidence: z.number().int().nonnegative(),
    coverage: z.number()
  }),
  sections: z.record(
    z.object({
      claims: z.number().int().nonnegative(),
      with_evidence: z.number().int().nonnegative(),
      coverage: z.number()
    })
  )
});

export const ApplicationFeed = z.object({
  latest: z.array(ArxivId),
  trending: z.array(ArxivId),
  query: z.string(),
  window: z.string()
});

export const EmergingClusters = z.object({
  generated_at: DateString,
  window_days: z.number().int().positive(),
  clusters: z.array(
    z.object({
      id: z.string(),
      keywords: z.array(z.string()).min(1),
      papers: z.array(ArxivId).min(1)
    })
  )
});

export const AtlasGraph = z.object({
  generated_at: DateString,
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
      group: z.string().optional()
    })
  ),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      weight: z.number(),
      kind: z.string()
    })
  ),
  note: z.string()
});

export const QueryPack = z.object({
  version: z.string(),
  group: z.string(),
  topics: z.array(z.string()).min(1),
  queries: z.array(z.string()).min(1)
});

export const RankingConfig = z.object({
  version: z.string(),
  weights: z.object({
    recency: z.number(),
    momentum: z.number(),
    cross_list: z.number(),
    churn: z.number()
  }),
  recency_half_life_days: z.number(),
  momentum_window_days: z.number(),
  baseline_window_days: z.number()
});

export const PaperTrail = z.object({
  id: z.string(),
  title: z.string(),
  premise: z.string(),
  steps: z
    .array(
      z.object({
        arxiv_id: ArxivId,
        why_it_matters: z.string(),
        claim_evidence: z.array(ArxivId).min(1)
      })
    )
    .min(4)
});

export const PaperTrails = z.array(PaperTrail).min(1);

export const AnchorList = z.object({
  anchors: z.array(ArxivId)
});

export const OaiState = z.object({
  last_harvest: z.string().optional(),
  resumption_token: z.string().optional()
});
