import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { SeenEventsStore } from "./types.js";

const seenEventsPath = resolve(process.cwd(), "data/seen-events.json");

export async function readSeenEventsStore(): Promise<SeenEventsStore> {
  try {
    const raw = await readFile(seenEventsPath, "utf8");
    return JSON.parse(raw) as SeenEventsStore;
  } catch {
    return { seenEventIds: [] };
  }
}

export async function writeSeenEventsStore(store: SeenEventsStore): Promise<void> {
  const deduped = Array.from(new Set(store.seenEventIds)).sort();
  await writeFile(
    seenEventsPath,
    `${JSON.stringify({ seenEventIds: deduped }, null, 2)}\n`,
    "utf8"
  );
}
