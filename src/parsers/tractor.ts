import { createHash } from "node:crypto";

import { extractTime, normalizeWhitespace, parseMonthDayText } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function extractTitleToUrlMap(html: string): Map<string, string> {
  const matches = html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
  const titleToUrl = new Map<string, string>();

  for (const match of matches) {
    const rawUrl = match[1];
    const rawTitle = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawTitle || rawTitle.toLowerCase().includes("get tickets")) {
      continue;
    }

    if (!rawUrl.includes("ticketweb.com")) {
      continue;
    }

    titleToUrl.set(rawTitle, rawUrl);
  }

  return titleToUrl;
}

export function parseTractor(html: string, context: ParserContext): ParserResult {
  const lines = html
    .split("\n")
    .map((line) => normalizeWhitespace(line.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")))
    .filter(Boolean);
  const titleToUrl = extractTitleToUrlMap(html);
  const events: LiveMusicEvent[] = [];
  let candidateCount = 0;
  let uncertainCount = 0;

  for (let index = 0; index < lines.length - 3; index += 1) {
    const title = lines[index];
    const dateLine = lines[index + 1];

    if (!titleToUrl.has(title)) {
      continue;
    }

    const parsedDate = parseMonthDayText(dateLine, context.now, context.timezone);
    if (!parsedDate) {
      uncertainCount += 1;
      continue;
    }

    candidateCount += 1;
    const url = titleToUrl.get(title) ?? context.source.url;
    const time = extractTime(dateLine);
    const basis = [
      "Parsed from Tractor Tavern calendar listing",
      time ? `listing includes start time ${time}` : "time was not clearly extracted",
      "venue fit suggests roots, Americana, rock, singer-songwriter, and live-band strength"
    ].join("; ");

    events.push({
      id: makeId(`${title}|${parsedDate}|${url}`),
      title,
      artist: title,
      venue: "Tractor Tavern",
      date: parsedDate,
      time,
      location: "5213 Ballard Ave N.W., Seattle, WA 98107",
      url,
      sourceName: context.source.name,
      genreHints: ["roots", "Americana", "rock", "singer-songwriter", "live bands"],
      confidence: "High",
      basis: normalizeWhitespace(basis)
    });
  }

  return {
    events,
    candidateCount,
    uncertainCount,
    parserConfidence: "High",
    statusMessage:
      candidateCount > 0
        ? "parsed TicketWeb-backed calendar blocks from Tractor Tavern"
        : "page fetched but no Tractor calendar blocks were recognized"
  };
}
