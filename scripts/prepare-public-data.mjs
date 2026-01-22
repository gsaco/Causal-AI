import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("data");
const targetDir = path.resolve("public/data");

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "_raw") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

await fs.rm(targetDir, { recursive: true, force: true });
await copyDir(sourceDir, targetDir);
console.log("Prepared public/data from data snapshots.");
