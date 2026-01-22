import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
  site: "https://gsaco.github.io",
  base: "/Causal-AI",
  outDir: "docs",
  integrations: [mdx()],
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      theme: "github-dark"
    }
  }
});
