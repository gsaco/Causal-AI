import fs from "node:fs/promises";
import path from "node:path";

const arxivRegex = /(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?/gi;

async function listFiles(dir, extensions) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, extensions)));
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(full);
      }
    }
  }
  return files;
}

function countClaims(content) {
  const matches = content.matchAll(/<Claim\b[\s\S]*?>/g);
  let claims = 0;
  let withEvidence = 0;
  for (const match of matches) {
    const tag = match[0];
    claims += 1;
    const evidenceMatch = tag.match(/evidence\s*=\s*\{([^}]+)\}/);
    if (!evidenceMatch) continue;
    const evidenceIds = Array.from(evidenceMatch[1].matchAll(arxivRegex)).map((m) => m[0]);
    if (evidenceIds.length > 0) withEvidence += 1;
  }
  return { claims, withEvidence };
}

function coverageRate({ claims, withEvidence }) {
  if (claims === 0) return 1;
  return Number((withEvidence / claims).toFixed(3));
}

async function scanSection(sectionPath, extensions) {
  let claims = 0;
  let withEvidence = 0;
  const files = await listFiles(sectionPath, extensions);
  for (const file of files) {
    const raw = await fs.readFile(file, "utf-8");
    const counts = countClaims(raw);
    claims += counts.claims;
    withEvidence += counts.withEvidence;
  }
  return { claims, withEvidence, coverage: coverageRate({ claims, withEvidence }) };
}

export async function computeCoverage({ dataDir = "data", writeOutput = false } = {}) {
  const sections = {};
  sections.topics = await scanSection(path.join("src", "content", "topics"), [".mdx"]);
  sections.trends = await scanSection(path.join("src", "content", "trends"), [".mdx"]).catch(() => ({ claims: 0, withEvidence: 0, coverage: 1 }));
  sections.applications = await scanSection(path.join("src", "content", "applications"), [".mdx"]).catch(() => ({ claims: 0, withEvidence: 0, coverage: 1 }));
  sections.frontiers = await scanSection(path.join("src", "content", "frontiers"), [".mdx"]).catch(() => ({ claims: 0, withEvidence: 0, coverage: 1 }));
  sections.digests = await scanSection(path.join("src", "content", "digests"), [".mdx"]);
  sections.glossary = await scanSection(path.join("src", "content", "glossary"), [".mdx"]);
  sections.tools = await scanSection(path.join("src", "pages"), ["tools.astro"]);
  sections.benchmarks = await scanSection(path.join("src", "pages"), ["benchmarks.astro"]);

  const totals = Object.values(sections).reduce(
    (acc, section) => {
      acc.claims += section.claims;
      acc.withEvidence += section.withEvidence;
      return acc;
    },
    { claims: 0, withEvidence: 0 }
  );

  const output = {
    generated_at: new Date().toISOString().slice(0, 10),
    overall: {
      ...totals,
      coverage: coverageRate(totals)
    },
    sections
  };

  if (writeOutput) {
    await fs.mkdir(path.join(dataDir, "metrics"), { recursive: true });
    await fs.writeFile(
      path.join(dataDir, "metrics", "citation_coverage.json"),
      JSON.stringify(output, null, 2)
    );
  }

  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  computeCoverage({ writeOutput: true }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
