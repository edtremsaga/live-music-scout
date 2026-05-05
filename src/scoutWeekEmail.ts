import { printScoutResult, runScout } from "./runScout.js";
import { sendEmail } from "./sendEmail.js";

async function main(): Promise<void> {
  const includeEvaluatedShows = process.argv.includes("--full");
  const result = await runScout({ reportKind: "week", includeEvaluatedShows });
  printScoutResult(result);
  console.log("");

  try {
    const messageId = await sendEmail({
      subject: result.subject,
      text: result.preview,
      html: result.html
    });
    console.log(`Email send succeeded. Message id: ${messageId}`);
  } catch (error) {
    console.error("Email send failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Live Music Scout weekly email run failed.");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
