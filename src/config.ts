import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Preferences, SeenEventsStore, SourceConfig } from "./types.js";

const root = process.cwd();

async function readJsonFile<T>(relativePath: string): Promise<T> {
  const filePath = resolve(root, relativePath);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export function getDataPath(relativePath: string): string {
  return resolve(root, relativePath);
}

export async function loadSources(): Promise<SourceConfig[]> {
  return readJsonFile<SourceConfig[]>("data/sources.json");
}

export async function loadPreferences(): Promise<Preferences> {
  return readJsonFile<Preferences>("data/preferences.json");
}

export async function loadSeenEvents(): Promise<SeenEventsStore> {
  return readJsonFile<SeenEventsStore>("data/seen-events.json");
}
