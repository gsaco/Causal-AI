import fs from "node:fs/promises";
import path from "node:path";
import { computeCoverage } from "./compute_coverage.mjs";

const arxivRegex = /(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(?:v\d+)?/gi;
const arxivIdPattern = /^(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})$/i;

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

function normalizeId(id) {
  return id.replace(/v\d+$/i, "");
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function extractIdsFromString(value) {
  const ids = [];
  const matches = value.matchAll(arxivRegex);
  for (const match of matches) {
    ids.push(normalizeId(match[0]));
  }
  return ids;
}

function extractFrontmatter(raw) {
  if (!raw.startsWith("---")) return { frontmatter: "", body: raw };
  const endIndex = raw.indexOf("\n---", 3);
  if (endIndex === -1) return { frontmatter: "", body: raw };
  const frontmatter = raw.slice(3, endIndex).trim();
  const body = raw.slice(endIndex + 4);
  return { frontmatter, body };
}

function extractList(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const ids = [];
  let collecting = false;
  for (const line of lines) {
    if (!collecting && line.startsWith(`${key}:`)) {
      collecting = true;
      continue;
    }
    if (collecting) {
      if (/^\S/.test(line)) break;
      const match = line.match(/-\s*"?([^"\s]+)"?/);
      if (match) ids.push(normalizeId(match[1]));
    }
  }
  return ids;
}

function validateIdFormat(ids, errors, filePath, line) {
  for (const id of ids) {
    if (!arxivIdPattern.test(id)) {
      errors.push(`${filePath}:${line} invalid arXiv id: ${id}`);
    }
  }
}

export async function validateCitations() {
  const errors = [];
  const knownIds = new Set();

  try {
    const files = await fs.readdir(path.join("data", "papers"));
    for (const file of files) {
      if (file.endsWith(".json")) knownIds.add(file.replace(/\.json$/, ""));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    const anchorsRaw = await fs.readFile(path.join("data", "taxonomy", "anchors.json"), "utf-8");
    const anchors = JSON.parse(anchorsRaw).anchors ?? [];
    for (const id of anchors) knownIds.add(normalizeId(id));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const mdxFiles = await listFiles(path.join("src", "content"), [".mdx"]);
  for (const file of mdxFiles) {
    const raw = await fs.readFile(file, "utf-8");
    const { frontmatter, body } = extractFrontmatter(raw);
    const frontmatterIds = extractIdsFromString(frontmatter);
    validateIdFormat(frontmatterIds, errors, file, 1);
    for (const id of frontmatterIds) {
      if (!knownIds.has(id)) {
        errors.push(`${file}:1 unknown arXiv id in frontmatter: ${id}`);
      }
    }

    const claimTags = body.matchAll(/<Claim\b[\s\S]*?>/g);
    for (const match of claimTags) {
      const tag = match[0];
      const line = lineNumberFromIndex(body, match.index ?? 0);
      if (!tag.includes("evidence")) {
        errors.push(`${file}:${line} Claim block missing evidence`);
        continue;
      }
      const evidenceMatch = tag.match(/evidence\s*=\s*\{([^}]+)\}/);
      const evidenceIds = evidenceMatch ? extractIdsFromString(evidenceMatch[1]) : [];
      if (evidenceIds.length === 0) {
        errors.push(`${file}:${line} Claim block has empty evidence array`);
      }
      validateIdFormat(evidenceIds, errors, file, line);
      for (const id of evidenceIds) {
        if (!knownIds.has(id)) {
          errors.push(`${file}:${line} Claim evidence not found in data: ${id}`);
        }
      }
    }

    if (file.includes("/trends/")) {
      const foundational = extractList(frontmatter, "foundational");
      const newWave = extractList(frontmatter, "new_wave");
      const debates = extractList(frontmatter, "debates");
      if (foundational.length < 2) {
        errors.push(`${file}:1 trend foundational needs >=2 IDs`);
      }
      if (newWave.length < 2) {
        errors.push(`${file}:1 trend new_wave needs >=2 IDs`);
      }
      if (debates.length < 1) {
        errors.push(`${file}:1 trend debates needs >=1 ID`);
      }
    }
  }

  const astroFiles = await listFiles(path.join("src"), [".astro"]);
  for (const file of astroFiles) {
    const raw = await fs.readFile(file, "utf-8");
    const claimTags = raw.matchAll(/<Claim\b[\s\S]*?>/g);
    for (const match of claimTags) {
      const tag = match[0];
      const line = lineNumberFromIndex(raw, match.index ?? 0);
      const evidenceMatch = tag.match(/evidence\s*=\s*\{([^}]+)\}/);
      const evidenceIds = evidenceMatch ? extractIdsFromString(evidenceMatch[1]) : [];
      if (!evidenceMatch || evidenceIds.length === 0) {
        errors.push(`${file}:${line} Claim block missing evidence`);
      }
      validateIdFormat(evidenceIds, errors, file, line);
      for (const id of evidenceIds) {
        if (!knownIds.has(id)) {
          errors.push(`${file}:${line} Claim evidence not found in data: ${id}`);
        }
      }
    }

    const evidenceArrays = raw.matchAll(/evidence\s*:\s*\[([^\]]*)\]/g);
    for (const match of evidenceArrays) {
      const line = lineNumberFromIndex(raw, match.index ?? 0);
      const ids = extractIdsFromString(match[1]);
      if (ids.length === 0) {
        errors.push(`${file}:${line} evidence array must contain at least one arXiv id`);
      }
      validateIdFormat(ids, errors, file, line);
      for (const id of ids) {
        if (!knownIds.has(id)) {
          errors.push(`${file}:${line} evidence id not found in data: ${id}`);
        }
      }
    }
  }

  const coverage = await computeCoverage();
  if (coverage.overall.coverage < 0.95) {
    errors.push(`Citation coverage below threshold: ${coverage.overall.coverage}`);
  }
  if ((coverage.sections.trends?.coverage ?? 1) < 1) {
    errors.push(`Trend citation coverage must be 100%`);
  }

  if (errors.length > 0) {
    console.error("Citation validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("Citation validation passed.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateCitations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
