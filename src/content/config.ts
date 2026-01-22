import { defineCollection, z } from "astro:content";

const topics = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    scope: z.string(),
    anchors: z.array(z.string()),
    last_reviewed: z.string(),
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

export const collections = { topics, glossary, digests };
