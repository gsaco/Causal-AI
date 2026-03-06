import { defineCollection, z } from "astro:content";

const resourceCard = z.object({
  label: z.string(),
  note: z.string().optional(),
  url: z.string().url().optional()
});

const topics = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    scope: z.string(),
    anchors: z.array(z.string()),
    last_reviewed: z.string(),
    thesis: z.string().optional(),
    why_now: z.string().optional(),
    landmark_papers: z.array(z.string()).optional(),
    rising_papers: z.array(z.string()).optional(),
    evaluation_cues: z.array(z.string()).optional(),
    benchmarks: z.array(resourceCard).optional(),
    tools: z.array(resourceCard).optional(),
    open_questions: z.array(z.string()).optional(),
    related_topics: z.array(z.string()).optional(),
    applications: z.array(z.string()).optional(),
    evidence_arxiv: z.array(z.string()).optional(),
    reading_path: z
      .object({
        beginner: z.array(z.string()),
        intermediate: z.array(z.string()).optional(),
        advanced: z.array(z.string()).optional()
      })
      .optional()
  })
});

const glossary = defineCollection({
  type: "content",
  schema: z.object({
    term: z.string(),
    definition: z.string(),
    evidence_arxiv: z.array(z.string())
  })
});

const digests = defineCollection({
  type: "content",
  schema: z.object({
    week: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    evidence_arxiv: z.array(z.string()).optional()
  })
});

const trends = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    signals: z.array(z.string()),
    thesis: z.string().optional(),
    why_now: z.string().optional(),
    foundational: z.array(z.string()),
    new_wave: z.array(z.string()),
    debates: z.array(z.string()),
    benchmarks: z.array(resourceCard).optional(),
    tools: z.array(resourceCard).optional(),
    open_problems: z
      .array(
        z.object({
          prompt: z.string(),
          evidence: z.array(z.string())
        })
      )
      .optional(),
    practical_signals: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          evidence: z.array(z.string()).optional()
        })
      )
      .optional(),
    last_reviewed: z.string()
  })
});

const applications = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    thesis: z.string().optional(),
    why_now: z.string().optional(),
    topics: z.array(z.string()).optional(),
    trends: z.array(z.string()).optional(),
    benchmarks: z.array(resourceCard).optional(),
    tools: z.array(resourceCard).optional(),
    open_questions: z.array(z.string()).optional(),
    evidence_arxiv: z.array(z.string()).optional(),
    last_reviewed: z.string()
  })
});

const frontiers = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    thesis: z.string().optional(),
    why_now: z.string().optional(),
    topics: z.array(z.string()).optional(),
    trends: z.array(z.string()).optional(),
    benchmarks: z.array(resourceCard).optional(),
    tools: z.array(resourceCard).optional(),
    open_questions: z.array(z.string()).optional(),
    evidence_arxiv: z.array(z.string()).optional(),
    last_reviewed: z.string()
  })
});

export const collections = { topics, glossary, digests, trends, applications, frontiers };
