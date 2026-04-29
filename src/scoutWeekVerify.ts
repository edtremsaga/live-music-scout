import { runScout } from "./runScout.js";
import { SCOUT_VERIFY_EMAIL_TO } from "./emailConfig.js";
import { sendEmail } from "./sendEmail.js";
import { generatePreSendVerificationEmail } from "./verifyReport.js";

async function main(): Promise<void> {
  const result = await runScout({ reportKind: "week", updateSeen: false });
  const report = generatePreSendVerificationEmail(result);
  console.log(report.text);
  console.log("");

  const messageId = await sendEmail({
    to: SCOUT_VERIFY_EMAIL_TO,
    subject: report.subject,
    text: report.text,
    html: report.html
  });
  console.log(`Verification email send succeeded to ${SCOUT_VERIFY_EMAIL_TO}. Message id: ${messageId}`);
}

main().catch((error) => {
  console.error("Live Music Scout weekly pre-send verification failed.");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
