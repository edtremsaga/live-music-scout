import { classifyEvents } from "./classifyEvents.js";
import { loadPreferences, loadSources } from "./config.js";
import { getPacificTimezone, getTonightKey } from "./dateUtils.js";
import { SCOUT_EMAIL_SUBJECT } from "./emailConfig.js";
import { fetchPage } from "./fetchPage.js";
import { generateEmailPreview } from "./generateEmail.js";
import { parsers } from "./parsers/index.js";
import { rankEvents } from "./rankEvents.js";
import { readSeenEventsStore, writeSeenEventsStore } from "./storage.js";
import type { LiveMusicEvent, RankedEvent, SourceRunStatus } from "./types.js";

export type ScoutRunResult = {
  generatedAt: Date;
  subject: string;
  preview: string;
  rankedEvents: RankedEvent[];
  statuses: SourceRunStatus[];
  finalEmailItemCount: number;
};

export async function runScout(): Promise<ScoutRunResult> {
  const now = new Date();
  const timezone = getPacificTimezone();
  const tonightKey = getTonightKey(now, timezone);

  const [sources, preferences, seenStore] = await Promise.all([
    loadSources(),
    loadPreferences(),
    readSeenEventsStore()
  ]);

  const allTonightEvents: LiveMusicEvent[] = [];
  const statuses: SourceRunStatus[] = [];

  for (const source of sources) {
    const parser = parsers[source.parser];

    if (!parser) {
      statuses.push({
        sourceName: source.name,
        parserName: source.parser,
        ok: false,
        fetchStatus: "failed",
        message: `No parser registered for "${source.parser}"`,
        candidateCount: 0,
        tonightCount: 0
      });
      continue;
    }

    try {
      const html = await fetchPage(source.url);
      const result = await parser(html, { source, now, timezone });
      const tonightEvents = result.events.filter((event) => event.date === tonightKey);
      const classifiedTonightEvents = classifyEvents(tonightEvents);
      const likelyMusicCount = classifiedTonightEvents.filter((event) => event.classification.isLikelyMusic).length;
      const excludedCount = classifiedTonightEvents.filter(
        (event) => !event.classification.isLikelyMusic && event.classification.eventType !== "unknown"
      ).length;
      const ambiguousCount = classifiedTonightEvents.filter(
        (event) => !event.classification.isLikelyMusic && event.classification.eventType === "unknown"
      ).length;

      allTonightEvents.push(...tonightEvents);
      statuses.push({
        sourceName: source.name,
        parserName: source.parser,
        ok: true,
        fetchStatus: "fetched",
        message: result.statusMessage,
        candidateCount: result.candidateCount ?? result.events.length,
        tonightCount: tonightEvents.length,
        parserConfidence: result.parserConfidence,
        uncertainCount: result.uncertainCount ?? 0,
        likelyMusicCount,
        excludedCount,
        ambiguousCount
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      statuses.push({
        sourceName: source.name,
        parserName: source.parser,
        ok: false,
        fetchStatus: "failed",
        message: `fetch or parse failed: ${message}`,
        candidateCount: 0,
        tonightCount: 0
      });
    }
  }

  const seenEventIds = new Set(seenStore.seenEventIds);
  const classifiedTonightEvents = classifyEvents(allTonightEvents);
  const rankedEvents = rankEvents(classifiedTonightEvents, preferences, seenEventIds);
  const preview = generateEmailPreview(now, rankedEvents);
  const finalEmailItemCount = rankedEvents.length;

  await writeSeenEventsStore({
    seenEventIds: [
      ...seenStore.seenEventIds,
      ...rankedEvents.filter((event) => event.verdict !== "Skip").map((event) => event.id)
    ]
  });

  return {
    generatedAt: now,
    subject: SCOUT_EMAIL_SUBJECT,
    preview,
    rankedEvents,
    statuses,
    finalEmailItemCount
  };
}

export function printScoutResult(result: ScoutRunResult): void {
  console.log("=== EMAIL PREVIEW ===");
  console.log(result.preview);
  console.log("");
  console.log("=== PARSER STATUS SUMMARY ===");
  console.log(`Final email item count: ${result.finalEmailItemCount}`);

  for (const status of result.statuses) {
    const confidenceText = status.parserConfidence ? `; confidence ${status.parserConfidence}` : "";
    const uncertaintyText =
      typeof status.uncertainCount === "number" && status.uncertainCount > 0
        ? `; ${status.uncertainCount} uncertain`
        : "";
    const classificationText =
      typeof status.likelyMusicCount === "number"
        ? `; ${status.likelyMusicCount} likely music, ${status.excludedCount ?? 0} non-music, ${status.ambiguousCount ?? 0} ambiguous`
        : "";

    console.log(
      `- ${status.sourceName}: ${status.fetchStatus}; ${status.candidateCount} parsed, ${status.tonightCount} tonight${classificationText}${confidenceText}${uncertaintyText}. ${status.message}`
    );
  }
}
