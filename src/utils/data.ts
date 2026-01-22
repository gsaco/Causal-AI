import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");

export async function readJson<T = any>(relativePath: string): Promise<T> {
  const filePath = path.join(dataDir, relativePath);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function listJsonFiles(relativeDir: string): Promise<string[]> {
  const dirPath = path.join(dataDir, relativeDir);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name);
}
