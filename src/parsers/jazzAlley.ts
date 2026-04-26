import { createHash } from "node:crypto";

import { extractTime, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import { fetchPage } from "../fetchPage.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const JAZZ_ALLEY_BASE_URL = "https://www.jazzalley.com";
const JAZZ_ALLEY_LOCATION = "2033 6th Ave, Seattle, WA 98121";

type JazzAlleyCalendarEntry = {
  title: string;
  url: string;
  dateText: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteJazzAlleyUrl(url: string): string {
  if (url.startsWith("http")) {
    return url;
  }

  return new URL(url, JAZZ_ALLEY_BASE_URL).toString();
}

export function extractJazzAlleyCalendarEntries(html: string): JazzAlleyCalendarEntry[] {
  const blockPattern = /<div class="news-box">([\s\S]*?)<\/div>\s*<\/div>/gi;
  const entries: JazzAlleyCalendarEntry[] = [];

  for (const match of html.matchAll(blockPattern)) {
    const block = match[1];
    const titleMatch = block.match(/<a href="([^"]*artist\.jsp\?shownum=\d+)"><h2>([\s\S]*?)<\/h2><\/a>/i);
    const dateMatch = block.match(/<em class="date">([\s\S]*?)<\/em>/i);
    const descriptionMatch = block.match(/<p>([\s\S]*?)<\/p>/i);

    if (!titleMatch || !dateMatch) {
      continue;
    }

    const url = toAbsoluteJazzAlleyUrl(titleMatch[1]);
    const title = normalizeWhitespace(stripHtml(titleMatch[2]));
    const dateText = normalizeWhitespace(stripHtml(dateMatch[1]));
    const description = descriptionMatch ? normalizeWhitespace(stripHtml(descriptionMatch[1])) : undefined;

    if (!title || !dateText) {
      continue;
    }

    entries.push({ title, url, dateText, description });
  }

  return entries;
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInclusiveDateRange(startKey: string, endKey: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);

  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function parseJazzAlleyDateRange(
  dateText: string,
  now: Date,
  timezone: string
): string[] {
  const cleaned = normalizeWhitespace(dateText.replace(/<br\s*\/?>/gi, " ").replace(/\s*-\s*/g, " - "));
  const rangeMatch = cleaned.match(
    /^(?:[A-Za-z]{3},\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?\s*-\s*(?:[A-Za-z]{3},\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?$/i
  );

  if (rangeMatch) {
    const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = rangeMatch;
    const resolvedEndYear = endYear ?? startYear;
    const resolvedStartYear = startYear ?? resolvedEndYear;

    if (!resolvedStartYear || !resolvedEndYear) {
      return [];
    }

    const startKey = parseMonthDayText(`${startMonth} ${startDay} ${resolvedStartYear}`, now, timezone);
    const endKey = parseMonthDayText(`${endMonth} ${endDay} ${resolvedEndYear}`, now, timezone);

    if (!startKey || !endKey || startKey > endKey) {
      return [];
    }

    return getInclusiveDateRange(startKey, endKey);
  }

  const singleKey = parseMonthDayText(cleaned, now, timezone);
  return singleKey ? [singleKey] : [];
}

export function extractJazzAlleyPerformanceMap(
  html: string,
  now: Date,
  timezone: string
): Map<string, string[]> {
  const performanceMap = new Map<string, string[]>();

  for (const match of html.matchAll(/<option[^>]*>([^<]+)<\/option>/gi)) {
    const optionText = normalizeWhitespace(stripHtml(match[1]));

    if (!optionText || optionText.toLowerCase().includes("choose a performance")) {
      continue;
    }

    const dateKey = parseMonthDayText(optionText, now, timezone);
    const time = extractTime(optionText);

    if (!dateKey || !time) {
      continue;
    }

    const existing = performanceMap.get(dateKey) ?? [];
    if (!existing.includes(time)) {
      existing.push(time);
      performanceMap.set(dateKey, existing);
    }
  }

  return performanceMap;
}

function collectGenreHints(title: string, description?: string): string[] {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["jazz", "seated venue", "local musicianship"]);

  if (blob.includes("soul")) {
    hints.add("soul");
  }

  if (blob.includes("blues")) {
    hints.add("blues");
  }

  if (blob.includes("rock")) {
    hints.add("rock");
  }

  if (blob.includes("guitar")) {
    hints.add("guitar-forward");
  }

  if (blob.includes("bass")) {
    hints.add("bass-forward");
  }

  if (blob.includes("songwriter") || blob.includes("singer")) {
    hints.add("singer-songwriter");
  }

  return [...hints];
}

function formatTimes(times: string[]): string | undefined {
  if (times.length === 0) {
    return undefined;
  }

  return times.join(" / ");
}

export async function parseJazzAlley(html: string, context: ParserContext): Promise<ParserResult> {
  const entries = extractJazzAlleyCalendarEntries(html);
  const events: LiveMusicEvent[] = [];
  let candidateCount = 0;
  let uncertainCount = 0;
  let detailFailures = 0;

  for (const entry of entries) {
    const listingDates = parseJazzAlleyDateRange(entry.dateText, context.now, context.timezone);

    if (listingDates.length === 0) {
      uncertainCount += 1;
      continue;
    }

    candidateCount += 1;
    let performanceMap = new Map<string, string[]>();
    let usedDetailSchedule = false;

    try {
      const detailHtml = await fetchPage(entry.url);
      performanceMap = extractJazzAlleyPerformanceMap(detailHtml, context.now, context.timezone);
      usedDetailSchedule = performanceMap.size > 0;
    } catch {
      detailFailures += 1;
    }

    const dateKeys = usedDetailSchedule ? [...performanceMap.keys()].sort() : listingDates;

    for (const dateKey of dateKeys) {
      const basisParts = [
        "Parsed from Jazz Alley calendar listing",
        usedDetailSchedule
          ? "detail page performance schedule confirmed this date"
          : "detail schedule unavailable, so the listing date range was used",
        "venue fit suggests seated jazz-club listening and strong musicianship"
      ];

      events.push({
        id: makeId(`${entry.title}|${dateKey}|${entry.url}`),
        title: entry.title,
        artist: entry.title,
        venue: "Dimitriou's Jazz Alley",
        date: dateKey,
        time: formatTimes(performanceMap.get(dateKey) ?? []),
        location: JAZZ_ALLEY_LOCATION,
        url: entry.url,
        sourceName: context.source.name,
        genreHints: collectGenreHints(entry.title, entry.description),
        description: entry.description,
        confidence: usedDetailSchedule ? "High" : "Medium",
        basis: basisParts.join("; ")
      });
    }
  }

  const detailNote = detailFailures > 0
    ? `; ${detailFailures} detail pages fell back to listing-only dates`
    : "";

  return {
    events,
    candidateCount,
    uncertainCount,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      candidateCount > 0
        ? `parsed Jazz Alley calendar entries and expanded dated runs${detailNote}`
        : "page fetched but no Jazz Alley calendar entries matched the expected structure"
  };
}
