const DEFAULT_TIMEOUT_MS = 12_000;

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

    if (error instanceof Error) {
      throw new Error(`Network request failed for ${url}: ${error.message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
