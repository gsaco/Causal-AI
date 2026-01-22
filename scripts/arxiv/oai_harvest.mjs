import fs from "node:fs/promises";
import path from "node:path";
import { throttledFetch } from "./http.mjs";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildUrl({ baseUrl, metadataPrefix, from, resumptionToken }) {
  const url = new URL(baseUrl);
  url.searchParams.set("verb", "ListRecords");
  if (resumptionToken) {
    url.searchParams.set("resumptionToken", resumptionToken);
  } else {
    url.searchParams.set("metadataPrefix", metadataPrefix);
    if (from) url.searchParams.set("from", from);
  }
  return url.toString();
}

function extractResumptionToken(xml) {
  const match = xml.match(/<resumptionToken[^>]*>([^<]*)<\/resumptionToken>/);
  return match?.[1] ?? "";
}

export async function harvestOai({ dataDir = "data", baseUrl = "https://export.arxiv.org/oai2", metadataPrefix = "arXivRaw" } = {}) {
  const statePath = path.join(dataDir, "provenance", "oai_state.json");
  let state = { last_harvest: undefined, resumption_token: undefined };
  try {
    state = JSON.parse(await fs.readFile(statePath, "utf-8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const from = state.last_harvest ?? formatDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
  const url = buildUrl({ baseUrl, metadataPrefix, from, resumptionToken: state.resumption_token });
  const response = await throttledFetch(url, { minIntervalMs: 3200 });
  const xml = await response.text();
  const token = extractResumptionToken(xml);

  const rawDir = path.join(dataDir, "_raw", "oai");
  await fs.mkdir(rawDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(path.join(rawDir, `oai-${stamp}.xml`), xml);

  const nextState = {
    last_harvest: formatDate(new Date()),
    resumption_token: token || undefined
  };
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(nextState, null, 2));

  return { token };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  harvestOai().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
