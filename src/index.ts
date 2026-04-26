import { printScoutResult, runScout } from "./runScout.js";

async function main(): Promise<void> {
  const result = await runScout();
  printScoutResult(result);
}

main().catch((error) => {
  console.error("Live Music Scout failed.");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
