import test from "node:test";
import assert from "node:assert/strict";
import { tagPaper } from "../scripts/arxiv/tag_topics.mjs";

test("tagging assigns topic tags based on keywords", () => {
  const paper = {
    title: "Invariant Risk Minimization for Distribution Shift",
    abstract: "We study invariant predictors.",
    primary_category: "cs.LG"
  };
  const topics = [
    {
      id: "distribution-shift",
      keywords_any: ["invariant", "distribution shift"],
      keywords_all: [],
      exclude_keywords: [],
      category_whitelist: ["cs.LG"]
    }
  ];
  const tags = tagPaper(paper, topics);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].topic_id, "distribution-shift");
});

test("tagging covers new taxonomy groups", () => {
  const samples = [
    {
      paper: { title: "Structural causal models and interventions", abstract: "SCM formulation", primary_category: "cs.AI" },
      topic: { id: "foundations-scm", keywords_any: ["structural causal", "SCM"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Latent confounding in causal discovery", abstract: "hidden confounder", primary_category: "cs.LG" },
      topic: { id: "latent-confounding-discovery", keywords_any: ["latent confound", "hidden confounder"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Instrumental variable estimation", abstract: "IV setting", primary_category: "econ.EM" },
      topic: { id: "instrumental-variables", keywords_any: ["instrumental variable", "IV"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Causal representation learning objectives", abstract: "disentanglement", primary_category: "cs.LG" },
      topic: { id: "causal-representation-learning", keywords_any: ["causal representation", "disentanglement"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Off-policy evaluation for causal RL", abstract: "policy evaluation", primary_category: "cs.AI" },
      topic: { id: "off-policy-evaluation", keywords_any: ["off-policy", "policy evaluation"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Causal reasoning in LLM agents", abstract: "LLM counterfactuals", primary_category: "cs.CL" },
      topic: { id: "causal-llms", keywords_any: ["LLM", "counterfactual"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Causal fairness constraints", abstract: "counterfactual fairness", primary_category: "cs.AI" },
      topic: { id: "causal-fairness", keywords_any: ["counterfactual fairness", "fairness"], keywords_all: [], exclude_keywords: [] }
    },
    {
      paper: { title: "Causal inference toolkit", abstract: "software pipeline", primary_category: "cs.LG" },
      topic: { id: "systems-tooling", keywords_any: ["toolkit", "software"], keywords_all: [], exclude_keywords: [] }
    }
  ];

  for (const sample of samples) {
    const tags = tagPaper(sample.paper, [sample.topic]);
    assert.ok(tags.some((tag) => tag.topic_id === sample.topic.id));
  }
});
