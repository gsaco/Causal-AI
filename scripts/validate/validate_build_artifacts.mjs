import fs from "node:fs/promises";
import path from "node:path";

async function dirSize(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      total += stat.size;
    }
  }
  return total;
}

export async function validateBuildArtifacts({ distDir = "dist", maxSizeMb = 80 } = {}) {
  const pagefindDir = path.join(distDir, "pagefind");
  try {
    await fs.access(pagefindDir);
  } catch {
    console.error("Build validation failed: dist/pagefind is missing.");
    process.exit(1);
  }

  const sizeBytes = await dirSize(distDir);
  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    console.error(`Build validation failed: dist size ${sizeMb.toFixed(2)} MB exceeds ${maxSizeMb} MB.`);
    process.exit(1);
  }

  console.log(`Build artifacts OK. dist size ${sizeMb.toFixed(2)} MB.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateBuildArtifacts().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
