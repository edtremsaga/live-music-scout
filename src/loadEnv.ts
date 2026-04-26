import { config } from "dotenv";

let didLoadEnv = false;

export function loadEnv(): void {
  if (didLoadEnv) {
    return;
  }

  config();
  config({ path: ".env.local", override: true });
  didLoadEnv = true;
}
