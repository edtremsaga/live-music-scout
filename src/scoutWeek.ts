import { printScoutResult, runScout } from "./runScout.js";

async function main(): Promise<void> {
  const result = await runScout({ reportKind: "week" });
  printScoutResult(result);
}

main().catch((error) => {
  console.error("Live Music Scout weekly preview failed.");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
