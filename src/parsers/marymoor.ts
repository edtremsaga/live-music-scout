import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const MARYMOOR_LOCATION = "6046 West Lake Sammamish Parkway NE, Redmond, WA 98052";

type MarymoorListing = {
  title: string;
  date: string;
  time?: string;
  url: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function extractFirst(pattern: RegExp, value: string): string | undefined {
  return value.match(pattern)?.[1];
}

function cleanDescription(value: string | undefined): string | undefined {
  const cleaned = normalizeWhitespace(stripHtml(value ?? ""));
  return cleaned || undefined;
}

function collectGenreHints(listing: MarymoorListing): string[] {
  const hints = new Set<string>(["outdoor concert", "summer concert", "Redmond", "large outdoor venue"]);
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["indie", "indie"],
    ["reggae", "reggae"],
    ["blues", "blues"],
    ["folk", "folk"],
    ["americana", "Americana"],
    ["country", "country"],
    ["soul", "soul"],
    ["band", "live bands"],
    ["with ", "support bill"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

export function extractMarymoorListings(html: string, now: Date, timezone: string): MarymoorListing[] {
  const listings: MarymoorListing[] = [];
  const sections = html.split('<div class="tw-section">').slice(1);

  for (const section of sections) {
    const titleLink = section.match(/<div class="tw-name">[\s\S]*?<a\s+href="([^"]+)"[^>]*title="Event Name - ([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const rawDate = cleanDisplayText(extractFirst(/<span class="tw-event-date">([\s\S]*?)<\/span>/i, section));

    if (!titleLink || !rawDate) {
      continue;
    }

    const [, url, titleAttribute, titleHtml] = titleLink;
    const title = cleanDisplayText(titleHtml);
    const titleWithTime = cleanDisplayText(titleAttribute);
    const date = parseMonthDayText(rawDate, now, timezone);
    const time = extractTime(titleWithTime);
    const description = cleanDescription(extractFirst(/<div class="tw-attractions">([\s\S]*?)<\/div>/i, section));

    if (!title || !date || !url) {
      continue;
    }

    listings.push({
      title,
      date,
      time,
      url,
      description
    });
  }

  return listings;
}

export function parseMarymoor(html: string, context: ParserContext): ParserResult {
  const listings = extractMarymoorListings(html, context.now, context.timezone);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.title}|${listing.date}|${listing.time ?? ""}|${listing.url}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.title,
      venue: "Marymoor Park",
      date: listing.date,
      time: listing.time,
      location: MARYMOOR_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Marymoor Live public static event rows",
        listing.time ? `listing includes start time ${listing.time}` : "time was not clearly extracted",
        "seasonal outdoor source suggests larger ticketed concert events"
      ].join("; "))
    });

    seenKeys.add(dedupeKey);
  }

  return {
    events,
    candidateCount,
    uncertainCount: 0,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      candidateCount > 0
        ? "parsed Marymoor Live public concert rows"
        : "Marymoor Live page fetched but no current public concert rows were recognized"
  };
}
