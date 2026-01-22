import fs from "node:fs/promises";
import path from "node:path";

const arxivAbsRegex = /^https:\/\/arxiv\.org\/abs\/(.+)$/i;
const arxivPdfRegex = /^https:\/\/arxiv\.org\/pdf\/(.+)\.pdf$/i;

async function listFiles(dir, extensions) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(full, extensions)));
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) files.push(full);
    }
  }
  return files;
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export async function validateLinks() {
  const errors = [];
  const astroFiles = await listFiles(path.join("src"), [".astro", ".mdx"]);

  for (const file of astroFiles) {
    const raw = await fs.readFile(file, "utf-8");
    const hrefMatches = raw.matchAll(/href\s*=\s*["'](\/[^"']+)["']/g);
    for (const match of hrefMatches) {
      const line = lineNumberFromIndex(raw, match.index ?? 0);
      const href = match[1];
      if (href.startsWith("//")) continue;
      errors.push(`${file}:${line} internal link should use withBase or be relative: ${href}`);
    }

    const srcMatches = raw.matchAll(/src\s*=\s*["'](\/[^"']+)["']/g);
    for (const match of srcMatches) {
      const line = lineNumberFromIndex(raw, match.index ?? 0);
      const src = match[1];
      if (src.startsWith("//")) continue;
      errors.push(`${file}:${line} asset link should use withBase or be relative: ${src}`);
    }
  }

  const papersDir = path.join("data", "papers");
  try {
    const files = await fs.readdir(papersDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(papersDir, file), "utf-8");
      const paper = JSON.parse(raw);
      const absMatch = arxivAbsRegex.exec(paper.links?.arxiv_abs ?? "");
      if (!absMatch || absMatch[1].replace(/v\d+$/, "") !== paper.arxiv_id) {
        errors.push(`data/papers/${file}: arxiv_abs link does not match arxiv_id`);
      }
      const pdfMatch = arxivPdfRegex.exec(paper.links?.arxiv_pdf ?? "");
      if (!pdfMatch || pdfMatch[1].replace(/v\d+$/, "") !== paper.arxiv_id) {
        errors.push(`data/papers/${file}: arxiv_pdf link does not match arxiv_id`);
      }
      if (paper.canonical_url && !arxivAbsRegex.test(paper.canonical_url)) {
        errors.push(`data/papers/${file}: canonical_url must be arXiv abs link`);
      }
      if (paper.pdf_url && !arxivPdfRegex.test(paper.pdf_url)) {
        errors.push(`data/papers/${file}: pdf_url must be arXiv pdf link`);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (errors.length > 0) {
    console.error("Link validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("Link validation passed.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateLinks().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
