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

function normalizeId(id) {
  return id.replace(/v\d+$/i, "");
}

export async function extractArxivIds({
  includeAnchors = true,
  includeContent = true,
  includeAstro = true
} = {}) {
  const ids = new Set();

  if (includeContent) {
    const mdxFiles = await listFiles(path.join("src", "content"), [".mdx"]);
    for (const file of mdxFiles) {
      const raw = await fs.readFile(file, "utf-8");
      const matches = raw.matchAll(arxivRegex);
      for (const match of matches) {
        ids.add(normalizeId(match[0]));
      }
    }
  }

  if (includeAstro) {
    const astroFiles = await listFiles(path.join("src"), [".astro"]);
    for (const file of astroFiles) {
      const raw = await fs.readFile(file, "utf-8");
      const matches = raw.matchAll(arxivRegex);
      for (const match of matches) {
        ids.add(normalizeId(match[0]));
      }
    }
  }

  if (includeAnchors) {
    try {
      const anchorsRaw = await fs.readFile(path.join("data", "taxonomy", "anchors.json"), "utf-8");
      const anchors = JSON.parse(anchorsRaw).anchors ?? [];
      for (const id of anchors) ids.add(normalizeId(id));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extractArxivIds().then((ids) => {
    console.log(JSON.stringify(Array.from(ids).sort(), null, 2));
  });
}
