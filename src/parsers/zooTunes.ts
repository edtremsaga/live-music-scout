import { createHash } from "node:crypto";

import { cleanDisplayText, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import { normalizePublicImageUrl } from "../imageUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const ZOOTUNES_LOCATION = "5500 Phinney Ave N, Seattle, WA 98103";
const ZOOTUNES_PAGE_URL = "https://www.zoo.org/zootunes";

type ZooTunesListing = {
  title: string;
  date: string;
  url: string;
  description?: string;
  imageUrl?: string;
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

function extractTicketUrl(block: string): string | undefined {
  return extractFirst(/<a[^>]+href="(https:\/\/www\.etix\.com\/ticket\/p\/[^"]+)"[^>]*>\s*Buy\s+TICKETS\s*<\/a>/i, block);
}

function extractImageUrl(block: string): string | undefined {
  const rawUrl = block.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1]
    ?? block.match(/<img\b[^>]*\bdata-src="([^"]+)"/i)?.[1];
  return normalizePublicImageUrl(rawUrl, ZOOTUNES_PAGE_URL);
}

function collectGenreHints(listing: ZooTunesListing): string[] {
  const hints = new Set<string>(["ZooTunes", "outdoor concert", "summer concert", "large outdoor venue"]);
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["indie", "indie"],
    ["folk", "folk"],
    ["americana", "Americana"],
    ["soul", "soul"],
    ["pop", "pop"],
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

export function extractZooTunesListings(html: string, now: Date, timezone: string): ZooTunesListing[] {
  const listings: ZooTunesListing[] = [];
  const blocks = html.match(/<figure class="wp-block-image[\s\S]*?(?=<figure class="wp-block-image|<h2 class="wp-block-heading[^>]*>Sponsors|$)/gi) ?? [];

  for (const block of blocks) {
    const titleMatches = Array.from(block.matchAll(/<h4 class="wp-block-heading[^"]*has-text-align-left[^"]*"[^>]*>([\s\S]*?)<\/h4>/gi));
    const title = cleanDisplayText(titleMatches.map((match) => stripHtml(match[1])).find((value) => value && !/sold out/i.test(value)));
    const dateText = cleanDisplayText(extractFirst(/<p[^>]*>\s*<strong>([A-Z][a-z]+ \d{1,2}, \d{4})<\/strong>\s*<\/p>/i, block));
    const date = dateText ? parseMonthDayText(dateText, now, timezone) : undefined;
    const ticketUrl = extractTicketUrl(block);

    if (!title || !date) {
      continue;
    }

    listings.push({
      title,
      date,
      url: ticketUrl ?? ZOOTUNES_PAGE_URL,
      description: cleanDescription(block.includes("SOLD OUT") ? "SOLD OUT" : undefined),
      imageUrl: extractImageUrl(block)
    });
  }

  return listings;
}

export function parseZooTunes(html: string, context: ParserContext): ParserResult {
  const listings = extractZooTunesListings(html, context.now, context.timezone);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.title}|${listing.date}|${listing.url}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.title,
      venue: "Woodland Park Zoo",
      date: listing.date,
      location: ZOOTUNES_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      imageUrl: listing.imageUrl,
      imageAlt: listing.imageUrl ? `${listing.title} event image` : undefined,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from the public ZooTunes page concert blocks",
        listing.url === ZOOTUNES_PAGE_URL ? "ticket/detail link was not listed separately" : "listing includes public ticket link",
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
        ? "parsed ZooTunes public concert blocks"
        : "ZooTunes page fetched but no current public concert blocks were recognized"
  };
}
