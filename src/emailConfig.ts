export const SCOUT_EMAIL_SUBJECT = "Live Music Scout — Tonight around Seattle/Bellevue";
export const SCOUT_WEEK_EMAIL_SUBJECT = "Live Music Scout — This Week around Seattle/Bellevue";
export const SCOUT_VERIFY_EMAIL_TO = "edtrem@hotmail.com";

export const REQUIRED_EMAIL_ENV_VARS = [
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "EMAIL_TO"
] as const;
