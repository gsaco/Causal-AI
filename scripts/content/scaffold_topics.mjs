import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");

const dataDir = "data";
const topicsPath = path.join(dataDir, "taxonomy", "topics.json");
const anchorsPath = path.join(dataDir, "taxonomy", "anchors.json");
const templatePath = path.join("templates", "topic.mdx");
const topicsDir = path.join("src", "content", "topics");

const fallbackEvidence = [
  "1803.01422",
  "1907.02893",
  "1705.08821",
  "1501.01332",
  "1703.06856",
  "2011.04216"
];

function formatList(items, indent = 2) {
  if (!items || items.length === 0) return `${" ".repeat(indent)}- "${fallbackEvidence[0]}"`;
  return items.map((item) => `${" ".repeat(indent)}- "${item}"`).join("\n");
}

function withFallback(anchors, needed = 2) {
  const unique = [...new Set([...(anchors ?? []), ...fallbackEvidence])];
  return unique.slice(0, needed);
}

function formatEvidenceArray(ids) {
  return `[${ids.map((id) => `"${id}"`).join(", ")}]`;
}

function sentenceCase(text) {
  if (!text) return "";
  const trimmed = text.trim().replace(/\.$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function fillTemplate(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output;
}

export function renderTopic({ topic, template }) {
  const evidencePrimary = withFallback(topic.anchors, 2);
  const evidenceSecondary = withFallback(topic.anchors, 3).slice(1, 3);

  const replacements = {
    title: topic.title,
    scope: topic.scope,
    anchors: formatList(topic.anchors ?? [], 2),
    last_reviewed: "2026-01-22",
    reading_beginner: formatList(withFallback(topic.anchors, 1), 4),
    reading_intermediate: formatList(withFallback(topic.anchors, 2).slice(1, 2) || withFallback(topic.anchors, 1), 4),
    reading_advanced: formatList(withFallback(topic.anchors, 3).slice(2, 3) || withFallback(topic.anchors, 1), 4),
    claim_evidence_primary: formatEvidenceArray(evidencePrimary),
    claim_evidence_signal: formatEvidenceArray(evidenceSecondary.length ? evidenceSecondary : evidencePrimary),
    claim_evidence_debate: formatEvidenceArray(evidencePrimary),
    claim_evidence_eval: formatEvidenceArray(evidenceSecondary.length ? evidenceSecondary : evidencePrimary),
    claim_evidence_open: formatEvidenceArray(evidencePrimary),
    claim_evidence_pitfall: formatEvidenceArray(evidencePrimary),
    claim_primary: `${topic.title} focuses on ${sentenceCase(topic.scope)}, and relies on explicit assumptions before interpreting effects.`,
    claim_signal: `Recent work in ${topic.title} emphasizes robustness checks and transparent reporting of causal assumptions.`,
    claim_debate: `A recurring debate in ${topic.title} concerns how much identifiability can be claimed without interventions.`,
    claim_eval: `Evaluation often uses synthetic interventions or held-out environments, which can miss deployment shifts in ${topic.title}.`,
    claim_open: `Open question: which minimal assumptions are sufficient to estimate effects in ${topic.title} under realistic data constraints?`,
    claim_pitfall: `Pitfall: treating predictive accuracy as evidence of causal validity within ${topic.title}.`,
    guardrail_not_prove: `Correlation alone is not evidence of intervention effects in ${topic.title}.`,
    guardrail_misstatements: `Avoid claiming causal impact without stating the estimand, assumptions, and sensitivity checks.`
  };

  return fillTemplate(template, replacements);
}

export async function scaffoldTopics() {
  const [topicsRaw, templateRaw] = await Promise.all([
    fs.readFile(topicsPath, "utf-8"),
    fs.readFile(templatePath, "utf-8")
  ]);
  const topics = JSON.parse(topicsRaw);
  await fs.mkdir(topicsDir, { recursive: true });

  const anchorSet = new Set();

  for (const topic of topics) {
    for (const anchor of topic.anchors ?? []) anchorSet.add(anchor);

    const outPath = path.join(topicsDir, `${topic.id}.mdx`);
    let exists = true;
    try {
      await fs.access(outPath);
    } catch (error) {
      exists = false;
    }

    if (exists && !force) continue;

    const content = renderTopic({ topic, template: templateRaw });
    await fs.writeFile(outPath, content);
  }

  const anchors = Array.from(anchorSet.values()).sort();
  await fs.writeFile(anchorsPath, JSON.stringify({ anchors }, null, 2));

  console.log("Topic scaffolding complete.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scaffoldTopics().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
