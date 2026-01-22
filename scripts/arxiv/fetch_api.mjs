import fs from "node:fs/promises";

async function main() {
  // Placeholder: wire to arXiv Atom API with 3.2s throttle.
  // Write raw responses to data/_raw (gitignored) and normalized JSON to data/.
  await fs.mkdir("data/_raw", { recursive: true });
  console.log("fetch_api.mjs placeholder: implement Atom ingestion here.");
}

main();
