import fs from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const maxTotalJsKb = 700;
const maxJsonKb = 500;

async function collectFiles(dir, ext) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, ext)));
    } else if (entry.isFile() && full.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  try {
    await fs.access(distDir);
  } catch (error) {
    console.log("perf_budget: dist/ not found, skipping.");
    return;
  }

  const jsFiles = await collectFiles(path.join(distDir, "_astro"), ".js").catch(() => []);
  const totalJs = await Promise.all(jsFiles.map(async (file) => (await fs.stat(file)).size));
  const totalJsKb = totalJs.reduce((acc, size) => acc + size, 0) / 1024;

  if (totalJsKb > maxTotalJsKb) {
    throw new Error(`Total JS bundle size ${totalJsKb.toFixed(1)}KB exceeds ${maxTotalJsKb}KB`);
  }

  const jsonFiles = await collectFiles(path.join(distDir, "data"), ".json").catch(() => []);
  for (const file of jsonFiles) {
    const sizeKb = (await fs.stat(file)).size / 1024;
    if (sizeKb > maxJsonKb) {
      throw new Error(`JSON file ${path.relative(distDir, file)} is ${sizeKb.toFixed(1)}KB (> ${maxJsonKb}KB)`);
    }
  }

  console.log("perf_budget: OK");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
