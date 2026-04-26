import nodemailer from "nodemailer";

import { REQUIRED_EMAIL_ENV_VARS } from "./emailConfig.js";
import { loadEnv } from "./loadEnv.js";

function getMissingEnvVars(): string[] {
  return REQUIRED_EMAIL_ENV_VARS.filter((name) => !process.env[name]?.trim());
}

export function assertEmailEnv(): {
  emailProvider: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  emailTo: string;
} {
  loadEnv();

  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    throw new Error(`Missing required email env vars: ${missing.join(", ")}`);
  }

  if (process.env.EMAIL_PROVIDER !== "smtp") {
    throw new Error(`Unsupported EMAIL_PROVIDER "${process.env.EMAIL_PROVIDER}". Use "smtp".`);
  }

  return {
    emailProvider: process.env.EMAIL_PROVIDER as string,
    smtpHost: process.env.SMTP_HOST as string,
    smtpPort: Number.parseInt(process.env.SMTP_PORT as string, 10),
    smtpSecure: (process.env.SMTP_SECURE as string).toLowerCase() === "true",
    smtpUser: process.env.SMTP_USER as string,
    smtpPass: process.env.SMTP_PASS as string,
    emailFrom: process.env.EMAIL_FROM as string,
    emailTo: process.env.EMAIL_TO as string
  };
}

export async function sendEmail(params: {
  subject: string;
  text: string;
  html?: string;
}): Promise<string> {
  const env = assertEmailEnv();
  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  const response = await transporter.sendMail({
    from: env.emailFrom,
    to: env.emailTo,
    subject: params.subject,
    text: params.text,
    html: params.html
  });

  return response.messageId ?? "unknown";
}
