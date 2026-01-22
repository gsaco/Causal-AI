import fs from "node:fs/promises";
import path from "node:path";

const preferredOutDirs = [
  ...(process.env.ASTRO_OUT_DIR ? [process.env.ASTRO_OUT_DIR] : []),
  "docs",
  "dist"
];

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

async function resolveOutDir(explicitDir) {
  if (explicitDir) {
    const candidate = path.resolve(explicitDir);
    await fs.access(candidate);
    return candidate;
  }
  for (const dir of preferredOutDirs) {
    const candidate = path.resolve(dir);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function validateBuildArtifacts({ distDir, maxSizeMb = 80 } = {}) {
  const outDir = await resolveOutDir(distDir);
  if (!outDir) {
    console.error("Build validation failed: no build output found.");
    process.exit(1);
  }

  const pagefindDir = path.join(outDir, "pagefind");
  try {
    await fs.access(pagefindDir);
  } catch {
    console.error(`Build validation failed: ${path.basename(outDir)}/pagefind is missing.`);
    process.exit(1);
  }

  const sizeBytes = await dirSize(outDir);
  const sizeMb = sizeBytes / (1024 * 1024);
  if (sizeMb > maxSizeMb) {
    console.error(`Build validation failed: ${path.basename(outDir)} size ${sizeMb.toFixed(2)} MB exceeds ${maxSizeMb} MB.`);
    process.exit(1);
  }

  console.log(`Build artifacts OK. ${path.basename(outDir)} size ${sizeMb.toFixed(2)} MB.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateBuildArtifacts().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
