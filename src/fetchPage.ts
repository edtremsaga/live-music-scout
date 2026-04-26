import { execFile } from "node:child_process";
import { promisify } from "node:util";

const DEFAULT_TIMEOUT_MS = 12_000;
const execFileAsync = promisify(execFile);

async function fetchViaCurl(url: string): Promise<string> {
  const { stdout } = await execFileAsync("curl", [
    "-fL",
    "-sS",
    "--max-time",
    `${Math.ceil(DEFAULT_TIMEOUT_MS / 1000)}`,
    "-A",
    "LiveMusicScout/0.1 (+local CLI prototype)",
    "-H",
    "accept: text/html,application/xhtml+xml",
    url
  ], {
    maxBuffer: 5 * 1024 * 1024
  });

  return stdout;
}

export async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "LiveMusicScout/0.1 (+local CLI prototype)",
        accept: "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    try {
      return await fetchViaCurl(url);
    } catch (curlError) {
      if (error instanceof Error) {
        const fallbackMessage = curlError instanceof Error ? `; curl fallback failed: ${curlError.message}` : "";
        throw new Error(`Network request failed for ${url}: ${error.message}${fallbackMessage}`);
      }
    }

    if (error instanceof Error) {
      throw new Error(`Network request failed for ${url}: ${error.message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
