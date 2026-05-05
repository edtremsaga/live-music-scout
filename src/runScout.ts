import { classifyEvents } from "./classifyEvents.js";
import { loadPreferences, loadSources } from "./config.js";
import { getDateKeyWithOffset, getPacificTimezone, isDateInRange } from "./dateUtils.js";
import { SCOUT_EMAIL_SUBJECT, SCOUT_WEEK_EMAIL_SUBJECT } from "./emailConfig.js";
import { fetchPage } from "./fetchPage.js";
import { generateEmailHtml, generateEmailPreview, generateWeeklyEmailHtml, generateWeeklyEmailPreview } from "./generateEmail.js";
import { parsers } from "./parsers/index.js";
import { rankEvents } from "./rankEvents.js";
import { readSeenEventsStore, writeSeenEventsStore } from "./storage.js";
import type { LiveMusicEvent, RankedEvent, ReportKind, SourceConfig, SourceRunStatus } from "./types.js";

export type ScoutRunResult = {
  generatedAt: Date;
  reportKind: ReportKind;
  subject: string;
  preview: string;
  html: string;
  rankedEvents: RankedEvent[];
  sources: SourceConfig[];
  statuses: SourceRunStatus[];
  finalEmailItemCount: number;
  startKey: string;
  endKey: string;
};

type RunScoutOptions = {
  reportKind?: ReportKind;
  includeEvaluatedShows?: boolean;
  updateSeen?: boolean;
};

export async function runScout(options: RunScoutOptions = {}): Promise<ScoutRunResult> {
  const now = new Date();
  const timezone = getPacificTimezone();
  const reportKind = options.reportKind ?? "tonight";
  const includeEvaluatedShows = options.includeEvaluatedShows ?? reportKind !== "week";
  const updateSeen = options.updateSeen ?? true;
  const startKey = getDateKeyWithOffset(now, 0, timezone);
  const endKey = getDateKeyWithOffset(now, reportKind === "week" ? 7 : 0, timezone);
  const matchedLabel = reportKind === "week" ? "in range" : "tonight";
  const subject = reportKind === "week" ? SCOUT_WEEK_EMAIL_SUBJECT : SCOUT_EMAIL_SUBJECT;

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
        matchedCount: 0,
        matchedLabel
      });
      continue;
    }

    try {
      const html = source.parser === "configuredTodo"
        ? ""
        : await fetchPage(source.url);
      const result = await parser(html, { source, now, timezone });
      const matchedEvents = result.events.filter((event) => isDateInRange(event.date, startKey, endKey));
      const classifiedMatchedEvents = classifyEvents(matchedEvents);
      const likelyMusicCount = classifiedMatchedEvents.filter((event) => event.classification.isLikelyMusic).length;
      const excludedCount = classifiedMatchedEvents.filter(
        (event) => !event.classification.isLikelyMusic && event.classification.eventType !== "unknown"
      ).length;
      const ambiguousCount = classifiedMatchedEvents.filter(
        (event) => !event.classification.isLikelyMusic && event.classification.eventType === "unknown"
      ).length;

      allTonightEvents.push(...matchedEvents);
      statuses.push({
        sourceName: source.name,
        parserName: source.parser,
        ok: true,
        fetchStatus: source.parser === "configuredTodo" ? "skipped" : "fetched",
        message: result.statusMessage,
        candidateCount: result.candidateCount ?? result.events.length,
        matchedCount: matchedEvents.length,
        matchedLabel,
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
        matchedCount: 0,
        matchedLabel
      });
    }
  }

  const seenEventIds = new Set(seenStore.seenEventIds);
  const classifiedTonightEvents = classifyEvents(allTonightEvents);
  const rankedEvents = rankEvents(classifiedTonightEvents, preferences, seenEventIds);
  const preview =
    reportKind === "week"
      ? generateWeeklyEmailPreview(now, rankedEvents, startKey, endKey, { includeEvaluatedShows })
      : generateEmailPreview(now, rankedEvents);
  const html =
    reportKind === "week"
      ? generateWeeklyEmailHtml(now, rankedEvents, startKey, endKey, { includeEvaluatedShows })
      : generateEmailHtml(now, rankedEvents);
  const finalEmailItemCount = rankedEvents.length;

  if (updateSeen) {
    await writeSeenEventsStore({
      seenEventIds: [
        ...seenStore.seenEventIds,
        ...rankedEvents.filter((event) => event.verdict !== "Skip").map((event) => event.id)
      ]
    });
  }

  return {
    generatedAt: now,
    reportKind,
    subject,
    preview,
    html,
    rankedEvents,
    sources,
    statuses,
    finalEmailItemCount,
    startKey,
    endKey
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
      `- ${status.sourceName}: ${status.fetchStatus}; ${status.candidateCount} parsed, ${status.matchedCount} ${status.matchedLabel}${classificationText}${confidenceText}${uncertaintyText}. ${status.message}`
    );
  }
}
