import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import { normalizePublicImageUrl } from "../imageUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const CHATEAU_BASE_URL = "https://www.ste-michelle.com";
const CHATEAU_LOCATION = "14111 NE 145th Street, Woodinville, WA 98072";

type ChateauListing = {
  title: string;
  date: string;
  time?: string;
  location?: string;
  description?: string;
  url: string;
  imageUrl?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteChateauUrl(url: string): string {
  return url.startsWith("http")
    ? url
    : new URL(url, CHATEAU_BASE_URL).toString();
}

function extractFirst(pattern: RegExp, value: string): string | undefined {
  return value.match(pattern)?.[1];
}

function parseChateauDate(block: string, now: Date, timezone: string): string | undefined {
  const month = cleanDisplayText(extractFirst(/event-list-month-M">([\s\S]*?)<\/span>/i, block));
  const day = cleanDisplayText(extractFirst(/event-list-day">([\s\S]*?)<\/span>/i, block));
  const year = cleanDisplayText(extractFirst(/event-list-year-L">([\s\S]*?)<\/span>/i, block));

  if (!month || !day || !year) {
    return undefined;
  }

  return parseMonthDayText(`${month} ${day} ${year}`, now, timezone);
}

function cleanDescription(value: string | undefined): string | undefined {
  const cleaned = normalizeWhitespace(stripHtml(value ?? ""))
    .replace(/\bFor tickets, visit ticketmaster\.com to purchase\.\s*/i, "")
    .replace(/\bQuestions\?\s*See our Summer Concert FAQs\s*/i, "");

  return cleaned || undefined;
}

function extractImageUrl(block: string): string | undefined {
  const rawUrl = block.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1]
    ?? block.match(/<img\b[^>]*\bdata-src="([^"]+)"/i)?.[1];
  return normalizePublicImageUrl(rawUrl, CHATEAU_BASE_URL);
}

function collectGenreHints(title: string, description?: string): string[] {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["outdoor concert", "summer concert", "Woodinville", "large outdoor venue"]);
  const keywordPairs: Array<[string, string]> = [
    ["jazz", "jazz"],
    ["rock", "rock"],
    ["pop", "pop"],
    ["country", "country"],
    ["folk", "folk"],
    ["americana", "Americana"],
    ["bluegrass", "bluegrass"],
    ["soul", "soul"],
    ["band", "live bands"],
    ["singer-songwriter", "singer-songwriter"],
    ["songwriter", "singer-songwriter"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

export function extractChateauSteMichelleListings(html: string, now: Date, timezone: string): ChateauListing[] {
  const listings: ChateauListing[] = [];
  const blocks = html.split('<div class="event-list-event">').slice(1);

  for (const rawBlock of blocks) {
    const block = rawBlock.split('<div class="event-list-event">')[0] ?? rawBlock;
    const title = cleanDisplayText(extractFirst(/<a class="event-list-name"[^>]*>([\s\S]*?)<\/a>/i, block));
    const href = extractFirst(/<a class="event-list-name" href="([^"]+)"/i, block);
    const date = parseChateauDate(block, now, timezone);
    const timeText = cleanDisplayText(extractFirst(/event-list-time">([\s\S]*?)<\/div>/i, block));
    const location = cleanDisplayText(extractFirst(/event-list-location">([\s\S]*?)<\/div>/i, block));
    const description = cleanDescription(extractFirst(/event-list-intro">([\s\S]*?)<\/div>/i, block));

    if (!title || !href || !date) {
      continue;
    }

    listings.push({
      title,
      date,
      time: extractTime(timeText),
      location: location || undefined,
      description,
      url: toAbsoluteChateauUrl(href),
      imageUrl: extractImageUrl(block)
    });
  }

  return listings;
}

export function parseChateauSteMichelle(html: string, context: ParserContext): ParserResult {
  const listings = extractChateauSteMichelleListings(html, context.now, context.timezone);
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
      venue: "Chateau Ste. Michelle Amphitheatre",
      date: listing.date,
      time: listing.time,
      location: CHATEAU_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing.title, listing.description),
      description: listing.description,
      imageUrl: listing.imageUrl,
      imageAlt: listing.imageUrl ? `${listing.title} event image` : undefined,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Chateau Ste. Michelle public summer concert rows",
        listing.time ? `listing includes start time ${listing.time}` : "time was not clearly extracted",
        "seasonal outdoor source suggests larger ticketed concert events rather than small-club bookings"
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
        ? "parsed Chateau Ste. Michelle public summer concert rows"
        : "Chateau Ste. Michelle page fetched but no current public summer concert rows were recognized"
  };
}
