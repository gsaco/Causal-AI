import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const footerPath = path.join(process.cwd(), "src", "components", "SiteFooter.astro");

test("footer includes Gabriel Saco attribution", async () => {
  const raw = await fs.readFile(footerPath, "utf-8");
  assert.match(raw, /Gabriel Saco/);
});
