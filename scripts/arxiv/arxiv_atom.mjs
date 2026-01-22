import { throttledFetch } from "./http.mjs";

function normalizeWhitespace(value) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripVersion(rawId) {
  if (!rawId) return { base: "", version: "" };
  const match = rawId.match(/^(.*?)(v\d+)?$/i);
  return {
    base: match?.[1] ?? rawId,
    version: match?.[2] ?? ""
  };
}

function extractIdFromUrl(value) {
  if (!value) return "";
  const match = value.match(/arxiv\.org\/abs\/([^?#]+)$/i);
  if (match) return match[1];
  return value;
}

function parseAttributes(raw) {
  const attrs = {};
  const matches = raw.matchAll(/(\w+)="([^"]*)"/g);
  for (const match of matches) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export function buildQueryUrl({
  search_query,
  id_list,
  start = 0,
  max_results = 100,
  sortBy = "submittedDate",
  sortOrder = "descending"
} = {}) {
  const url = new URL("http://export.arxiv.org/api/query");
  if (search_query) url.searchParams.set("search_query", search_query);
  if (id_list) url.searchParams.set("id_list", id_list);
  url.searchParams.set("start", String(start));
  url.searchParams.set("max_results", String(max_results));
  if (sortBy) url.searchParams.set("sortBy", sortBy);
  if (sortOrder) url.searchParams.set("sortOrder", sortOrder);
  return url.toString();
}

export function parseAtomXml(xml) {
  const entries = [];
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  for (const match of entryMatches) {
    const entryXml = match[1];
    const idRaw = entryXml.match(/<id>([^<]+)<\/id>/)?.[1] ?? "";
    const idFromUrl = stripVersion(extractIdFromUrl(idRaw));
    const arxivId = idFromUrl.base;
    const versionFromId = idFromUrl.version;
    const title = decodeXml(entryXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const summary = decodeXml(entryXml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "");
    const updated = entryXml.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
    const published = entryXml.match(/<published>([^<]+)<\/published>/)?.[1] ?? "";

    const authors = Array.from(entryXml.matchAll(/<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g)).map(
      (authorMatch) => ({ name: decodeXml(authorMatch[1]) })
    );

    const categories = Array.from(entryXml.matchAll(/<category[^>]*term="([^"]+)"[^>]*\/>/g)).map(
      (catMatch) => catMatch[1]
    );
    const primaryCategory =
      entryXml.match(/<arxiv:primary_category[^>]*term="([^"]+)"/i)?.[1] ?? categories[0] ?? "";

    const links = Array.from(entryXml.matchAll(/<link([^>]+)\/>/g)).map((linkMatch) => parseAttributes(linkMatch[1]));
    const absLink =
      links.find((link) => link.rel === "alternate")?.href ?? `https://arxiv.org/abs/${arxivId}`;
    const pdfLink =
      links.find((link) => link.type === "application/pdf")?.href ?? `https://arxiv.org/pdf/${arxivId}.pdf`;

    const versions = Array.from(entryXml.matchAll(/<arxiv:version[^>]*version="([^"]+)"[^>]*created="([^"]+)"[^>]*\/>/g)).map(
      (versionMatch) => ({ version: versionMatch[1], updated_at: versionMatch[2] })
    );
    if (versions.length === 0 && versionFromId) {
      versions.push({
        version: versionFromId,
        updated_at: updated || published
      });
    }

    entries.push({
      arxiv_id: arxivId,
      title: normalizeWhitespace(title),
      summary: normalizeWhitespace(summary),
      authors,
      published,
      updated,
      categories,
      primary_category: primaryCategory,
      links: {
        abs: absLink,
        pdf: pdfLink
      },
      versions
    });
  }

  const totalResults = Number(xml.match(/<opensearch:totalResults>([^<]+)<\/opensearch:totalResults>/)?.[1] ?? 0) || 0;
  return { feed: {}, entries, totalResults };
}

export async function fetchPage(params, options = {}) {
  const url = buildQueryUrl(params);
  const response = await throttledFetch(url, options);
  const xml = await response.text();
  const parsed = parseAtomXml(xml);
  return { xml, ...parsed };
}

export async function fetchAllByQuery(params, options = {}) {
  const max_results = params.max_results ?? 100;
  let start = params.start ?? 0;
  let totalResults = Infinity;
  const allEntries = [];

  while (start < totalResults) {
    const { entries, totalResults: total } = await fetchPage({ ...params, start, max_results }, options);
    totalResults = total || totalResults;
    allEntries.push(...entries);
    if (entries.length < max_results) break;
    start += max_results;
  }

  return allEntries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const search = process.argv[2] ?? "cat:cs.LG";
  fetchPage({ search_query: search, max_results: 5 })
    .then(({ entries }) => {
      console.log(`Fetched ${entries.length} entries for ${search}`);
      if (entries[0]) console.log(entries[0]);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
