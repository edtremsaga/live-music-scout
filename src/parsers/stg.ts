import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const STG_BASE_URL = "https://www.stgpresents.org";

const KNOWN_VENUES = [
  "The Paramount Theatre",
  "The Moore Theatre",
  "The Neptune Theatre",
  "Kerry Hall",
  "Remlinger Farms",
  "5th Avenue Theatre"
];

export type StgListing = {
  title: string;
  url?: string;
  venue: string;
  dateText: string;
  timeText?: string;
  location?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteStgUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith("http") ? url : `${STG_BASE_URL}${url}`;
}

function extractMatch(block: string, pattern: RegExp): string | undefined {
  const match = block.match(pattern);
  return match?.[1];
}

function extractEventUrlFromBlock(block: string): string | undefined {
  const titleLink = extractMatch(
    block,
    /<h3[^>]*class="[^"]*mec-event-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/i
  );

  if (titleLink?.includes("/events/")) {
    return toAbsoluteStgUrl(titleLink);
  }

  const bookingLink = extractMatch(
    block,
    /<a[^>]*class="[^"]*mec-booking-button[^"]*"[^>]+href="([^"]+)"[^>]*>/i
  );

  if (bookingLink?.includes("/events/")) {
    return toAbsoluteStgUrl(bookingLink);
  }

  const imageLink = extractMatch(
    block,
    /<div[^>]*class="[^"]*mec-event-image[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/i
  );

  if (imageLink?.includes("/events/")) {
    return toAbsoluteStgUrl(imageLink);
  }

  return undefined;
}

export function extractStgListings(html: string): StgListing[] {
  const listings: StgListing[] = [];

  for (const match of html.matchAll(/<article[^>]*class="[^"]*mec-event-article[^"]*"[^>]*>[\s\S]*?<\/article>/gi)) {
    const block = match[0];
    const title = cleanDisplayText(
      stripHtml(extractMatch(block, /<h3[^>]*class="[^"]*mec-event-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ?? "")
    );
    const venue = cleanDisplayText(
      extractMatch(block, /<div[^>]*class="[^"]*mec-venue-details[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
    );
    const dateText = cleanDisplayText(
      extractMatch(block, /<span[^>]*class="[^"]*mec-start-date-label[^"]*"[^>]*>([^<]+)<\/span>/i)
    );
    const timeText = cleanDisplayText(
      extractMatch(block, /<span[^>]*class="[^"]*mec-start-time[^"]*"[^>]*>([^<]+)<\/span>/i)
        ?? extractMatch(block, /<div[^>]*class="[^"]*mec-event-description[^"]*"[^>]*>[\s\S]*?<br>\s*([^<]+)\s*<br>/i)
    );
    const location = cleanDisplayText(
      extractMatch(block, /<address[^>]*class="[^"]*mec-event-address[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)
    );

    if (!title || !venue || !dateText || !KNOWN_VENUES.includes(venue)) {
      continue;
    }

    listings.push({
      title,
      url: extractEventUrlFromBlock(block),
      venue,
      dateText,
      timeText: timeText || undefined,
      location: location || undefined
    });
  }

  return listings;
}

export function parseStg(html: string, context: ParserContext): ParserResult {
  const listings = extractStgListings(html);
  const events: LiveMusicEvent[] = [];
  const seenEvents = new Set<string>();

  for (const listing of listings) {
    const parsedDate = parseMonthDayText(listing.dateText, context.now, context.timezone);

    if (!parsedDate) {
      continue;
    }

    const title = normalizeWhitespace(stripHtml(listing.title));
    const timeLine = listing.timeText ? extractTime(listing.timeText) ?? listing.timeText : undefined;
    const url = listing.url ?? context.source.url;
    const eventKey = `${title}|${listing.venue}|${parsedDate}|${timeLine ?? ""}|${url}`;

    if (seenEvents.has(eventKey)) {
      continue;
    }

    const basisParts = [
      "Parsed from STG event card",
      listing.url ? "detail URL found on event card" : "detail URL not found; used listing page",
      timeLine ? `time found as ${timeLine}` : "time not clearly found",
      listing.location ? "venue address present" : "address inferred from venue"
    ];

    events.push({
      id: makeId(eventKey),
      title,
      artist: title,
      venue: listing.venue,
      date: parsedDate,
      time: timeLine,
      location: listing.location ?? context.source.location ?? "Seattle, WA",
      url,
      sourceName: context.source.name,
      genreHints: [listing.venue.toLowerCase().includes("neptune") ? "rock" : "touring act", "larger venue"],
      confidence: listing.location ? "High" : "Medium",
      basis: normalizeWhitespace(basisParts.join("; "))
    });

    seenEvents.add(eventKey);
  }

  return {
    events,
    candidateCount: listings.length,
    parserConfidence: "Medium",
    statusMessage:
      listings.length > 0
        ? "parsed STG event cards for larger touring-venue events"
        : "parsed page but found no confident STG event cards"
  };
}
