import { runPipeline } from "./run.mjs";

runPipeline().catch((error) => {
  console.error(error);
  process.exit(1);
});
