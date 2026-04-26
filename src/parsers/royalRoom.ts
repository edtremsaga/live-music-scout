import { createHash } from "node:crypto";

import { extractTime, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const WEEKDAY_PATTERN = "(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)";

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function extractEventAnchors(html: string): Array<{ url: string; text: string }> {
  const matches = html.matchAll(/<a[^>]+href="([^"]*\/event\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
  const anchors: Array<{ url: string; text: string }> = [];

  for (const match of matches) {
    const url = match[1].startsWith("http")
      ? match[1]
      : `https://theroyalroomseattle.com${match[1]}`;
    const text = normalizeWhitespace(stripHtml(match[2]));

    if (!text) {
      continue;
    }

    anchors.push({ url, text });
  }

  return anchors;
}

export function parseRoyalRoom(html: string, context: ParserContext): ParserResult {
  const anchors = extractEventAnchors(html);
  const events: LiveMusicEvent[] = [];
  let candidateCount = 0;
  let uncertainCount = 0;

  const pattern = new RegExp(
    `^\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{1,2}\\s+[A-Za-z]{3}\\s+(.+?)\\s+${WEEKDAY_PATTERN},\\s+([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})\\s+@\\s+(\\d{1,2}:\\d{2}\\s+[AP]M)(?:\\s+-\\s*(.*))?$`,
    "i"
  );

  for (const anchor of anchors) {
    const match = anchor.text.match(pattern);
    if (!match) {
      continue;
    }

    const [, title, , dateText, timeText, tail] = match;
    const parsedDate = parseMonthDayText(dateText, context.now, context.timezone);

    if (!parsedDate) {
      uncertainCount += 1;
      continue;
    }

    candidateCount += 1;
    const basisParts = [
      "Parsed from The Royal Room events listing",
      "venue fit suggests jazz, soul, funk, strong local musicianship, and a more comfortable seated setup",
      tail ? `listing notes ${tail}` : "genre was not explicit on listing text"
    ];

    events.push({
      id: makeId(`${title}|${parsedDate}|${anchor.url}`),
      title,
      artist: title,
      venue: "The Royal Room",
      date: parsedDate,
      time: extractTime(timeText) ?? timeText,
      location: "5000 Rainier Avenue S, Seattle, WA 98118",
      url: anchor.url,
      sourceName: context.source.name,
      genreHints: ["local musicianship", "comfortable room"],
      confidence: tail?.toLowerCase().includes("free") ? "Medium" : "High",
      basis: basisParts.join("; ")
    });
  }

  return {
    events,
    candidateCount,
    uncertainCount,
    parserConfidence: "High",
    statusMessage:
      candidateCount > 0
        ? "parsed event-listing anchors from The Royal Room"
        : "page fetched but no Royal Room event anchors matched the expected pattern"
  };
}
