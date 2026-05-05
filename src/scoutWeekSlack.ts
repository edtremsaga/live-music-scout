import { generateWeeklySlackReport } from "./generateEmail.js";
import { runScout } from "./runScout.js";

async function main(): Promise<void> {
  const includeEvaluatedShows = process.argv.includes("--full");
  const result = await runScout({ reportKind: "week", includeEvaluatedShows, updateSeen: false });

  console.log(generateWeeklySlackReport(
    result.rankedEvents,
    result.startKey,
    result.endKey,
    { includeEvaluatedShows }
  ));
}

main().catch((error) => {
  console.error("Live Music Scout weekly Slack report failed.");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
