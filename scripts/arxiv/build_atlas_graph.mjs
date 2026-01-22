import fs from "node:fs/promises";
import path from "node:path";

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function buildAtlasGraph({ dataDir = "data" } = {}) {
  const topicsRaw = await fs.readFile(path.join(dataDir, "taxonomy", "topics.json"), "utf-8");
  const topics = JSON.parse(topicsRaw);

  const motifs = [
    { id: "motif-invariance", label: "invariance", type: "motif" },
    { id: "motif-intervention", label: "intervention", type: "motif" },
    { id: "motif-counterfactual", label: "counterfactual", type: "motif" },
    { id: "motif-identifiability", label: "identifiability", type: "motif" },
    { id: "motif-robustness", label: "robustness", type: "motif" }
  ];

  const nodes = [
    ...topics.map((topic) => ({
      id: topic.id,
      label: topic.title,
      type: "topic",
      group: topic.group ?? "Other"
    })),
    ...motifs
  ];

  const edges = [];
  const groups = new Map();
  for (const topic of topics) {
    const group = topic.group ?? "Other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(topic);
  }

  for (const [group, groupTopics] of groups.entries()) {
    for (let i = 0; i < groupTopics.length - 1; i += 1) {
      edges.push({
        source: groupTopics[i].id,
        target: groupTopics[i + 1].id,
        weight: 0.4,
        kind: "similarity"
      });
    }
  }

  for (const topic of topics) {
    edges.push({
      source: topic.id,
      target: "motif-intervention",
      weight: 0.2,
      kind: "similarity"
    });
    if (topic.title.toLowerCase().includes("counterfactual")) {
      edges.push({
        source: topic.id,
        target: "motif-counterfactual",
        weight: 0.5,
        kind: "similarity"
      });
    }
    if (topic.title.toLowerCase().includes("invariance") || topic.id === "distribution-shift") {
      edges.push({
        source: topic.id,
        target: "motif-invariance",
        weight: 0.5,
        kind: "similarity"
      });
    }
  }

  const output = {
    generated_at: formatDate(),
    nodes,
    edges,
    note: "Edges reflect tag and keyword similarity signals, not causal relationships."
  };

  await fs.mkdir(path.join(dataDir, "atlas"), { recursive: true });
  await fs.writeFile(path.join(dataDir, "atlas", "graph.json"), JSON.stringify(output, null, 2));
  console.log("Atlas graph generated.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildAtlasGraph().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
