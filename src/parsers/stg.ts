import { createHash } from "node:crypto";

import { extractTime, getTextLines, normalizeWhitespace, parseMonthDayText } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const KNOWN_VENUES = [
  "The Paramount Theatre",
  "The Moore Theatre",
  "The Neptune Theatre",
  "Kerry Hall",
  "Remlinger Farms",
  "5th Avenue Theatre"
];

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function looksLikeTitle(line: string): boolean {
  if (line.length < 4 || line.length > 120) {
    return false;
  }

  const lower = line.toLowerCase();
  if (lower.includes("tickets & info") || lower.includes("get tickets") || lower === "events") {
    return false;
  }

  return /[a-z]/i.test(line) && !KNOWN_VENUES.includes(line);
}

function extractEventUrl(html: string, title: string): string | undefined {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const linkPattern = new RegExp(`<a[^>]+href="([^"]+)"[^>]*>\\s*${escapedTitle}\\s*<`, "i");
  const match = html.match(linkPattern);

  if (!match?.[1]) {
    return undefined;
  }

  return match[1].startsWith("http") ? match[1] : `https://www.stgpresents.org${match[1]}`;
}

export function parseStg(html: string, context: ParserContext): ParserResult {
  const lines = getTextLines(html);
  const events: LiveMusicEvent[] = [];
  const seenTitles = new Set<string>();
  let candidateCount = 0;

  for (let index = 0; index < lines.length - 4; index += 1) {
    const title = lines[index];
    const venue = lines[index + 1];
    const dateLine = lines[index + 2];

    if (!looksLikeTitle(title) || !KNOWN_VENUES.includes(venue)) {
      continue;
    }

    const parsedDate = parseMonthDayText(dateLine, context.now, context.timezone)
      ?? parseMonthDayText(lines[index + 3], context.now, context.timezone);

    if (!parsedDate) {
      continue;
    }

    candidateCount += 1;
    if (seenTitles.has(`${title}|${venue}|${parsedDate}`)) {
      continue;
    }

    const timeLine = [lines[index + 2], lines[index + 3], lines[index + 4], lines[index + 5]]
      .map((line) => (line ? extractTime(line) : undefined))
      .find(Boolean);

    const locationLine = lines
      .slice(index + 3, index + 8)
      .find((line) => line.includes("Seattle, WA"));

    const url = extractEventUrl(html, title) ?? context.source.url;
    const basisParts = [
      "Parsed from STG event listing text",
      timeLine ? `time found as ${timeLine}` : "time not clearly found",
      locationLine ? "venue address present" : "address inferred from venue"
    ];

    events.push({
      id: makeId(`${title}|${venue}|${parsedDate}|${url}`),
      title,
      artist: title,
      venue,
      date: parsedDate,
      time: timeLine,
      location: locationLine ?? context.source.location ?? "Seattle, WA",
      url,
      sourceName: context.source.name,
      genreHints: [venue.toLowerCase().includes("neptune") ? "rock" : "touring act", "larger venue"],
      confidence: locationLine ? "High" : "Medium",
      basis: normalizeWhitespace(basisParts.join("; "))
    });

    seenTitles.add(`${title}|${venue}|${parsedDate}`);
  }

  return {
    events,
    candidateCount,
    parserConfidence: "Medium",
    statusMessage:
      candidateCount > 0
        ? "parsed STG listing blocks for larger touring-venue events"
        : "parsed page but found no confident STG listing blocks"
  };
}
