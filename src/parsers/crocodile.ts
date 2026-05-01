import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const VENUE_DETAILS: Record<string, { location: string; hints: string[] }> = {
  "The Crocodile": {
    location: "2505 1st Ave, Seattle, WA 98121",
    hints: ["live music", "concert", "Belltown club", "The Crocodile"]
  },
  "Madame Lou's": {
    location: "2505 1st Ave, Seattle, WA 98121",
    hints: ["live music", "concert", "Belltown club", "Madame Lou's"]
  },
  "Here - After": {
    location: "2505 1st Ave, Seattle, WA 98121",
    hints: ["live music", "concert", "Belltown room", "Here-After"]
  }
};

const EXCLUDED_VENUES = [
  "Hotel Crocodile",
  "Baba Yaga",
  "Sunset Tavern",
  "Nectar Lounge",
  "Washington Hall"
];

export type CrocodileListing = {
  title: string;
  venue: "The Crocodile" | "Madame Lou's" | "Here - After";
  date: string;
  time?: string;
  url: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function getTicketWebEventAnchors(html: string): Array<{ index: number; href: string; title: string }> {
  return [...html.matchAll(/<a\b[^>]*href="([^"]*ticketweb\.com\/event\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      href: cleanTicketWebUrl(match[1]),
      title: cleanDisplayText(stripHtml(match[2])).replace(/^Image:\s*/i, "")
    }))
    .filter((anchor) => anchor.title && !/^find tickets$/i.test(anchor.title));
}

function cleanTicketWebUrl(value: string): string {
  return cleanDisplayText(value)
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/&amp;/g, "&");
}

function getVenueFromBlock(blockText: string): CrocodileListing["venue"] | undefined {
  if (/\bThe Crocodile,\s*Seattle,\s*WA\b/i.test(blockText)) {
    return "The Crocodile";
  }

  if (/\bMadame Lou'?s,\s*Seattle,\s*WA\b/i.test(blockText)) {
    return "Madame Lou's";
  }

  if (/\bHere\s*-\s*After,\s*Seattle,\s*WA\b/i.test(blockText)) {
    return "Here - After";
  }

  return undefined;
}

function hasExcludedVenue(blockText: string): boolean {
  return EXCLUDED_VENUES.some((venue) => new RegExp(`\\b${venue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blockText));
}

function isHereAfterMusicListing(title: string, description?: string): boolean {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const musicSignals = [
    "album release",
    "record release",
    "ep release",
    "concert",
    "live music",
    "band",
    "trio",
    "quartet",
    "jazz",
    "blues",
    "soul",
    "funk",
    "rock",
    "punk",
    "metal",
    "indie",
    "hip hop",
    "dj",
    "disco",
    "karaoke",
    "tribute",
    "tour"
  ];

  return musicSignals.some((signal) => blob.includes(signal));
}

function collectGenreHints(listing: CrocodileListing): string[] {
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const hints = new Set<string>(VENUE_DETAILS[listing.venue].hints);
  const keywordPairs: Array<[string, string]> = [
    ["album release", "album release"],
    ["ep release", "album release"],
    ["record release", "album release"],
    ["tour", "touring act"],
    ["showcase", "showcase"],
    ["with ", "supporting artists"],
    [" w/ ", "supporting artists"],
    ["dance party", "dance party"],
    ["club night", "club night"],
    ["dj", "DJ"],
    ["disco", "disco"],
    ["indie", "indie rock"],
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["hip hop", "hip-hop"],
    ["rap", "hip-hop"],
    ["comedy", "comedy"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function makeDescription(blockText: string, title: string, venue: string): string | undefined {
  const description = cleanDisplayText(blockText
    .replace(/^Image:\s*/i, "")
    .replaceAll(title, "")
    .replace(new RegExp(`${venue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\s*Seattle,\\s*WA`, "i"), "")
    .replace(/\bFind Tickets\b/gi, "")
    .replace(/\bOn partner site\b/gi, ""));

  return description || undefined;
}

export function extractCrocodileListings(html: string, context: ParserContext): CrocodileListing[] {
  const anchors = getTicketWebEventAnchors(html);
  const listings: CrocodileListing[] = [];
  const seenUrls = new Set<string>();

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    const nextAnchor = anchors[index + 1];

    if (seenUrls.has(anchor.href)) {
      continue;
    }

    const block = html.slice(anchor.index, nextAnchor?.index ?? undefined);
    const blockText = cleanDisplayText(stripHtml(block));

    if (/cancelled/i.test(blockText) || hasExcludedVenue(blockText)) {
      continue;
    }

    const venue = getVenueFromBlock(blockText);
    if (!venue) {
      continue;
    }

    const dateLine = blockText.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:\s+\d{4})?\s+\d{1,2}(?::\d{2})?\s*[AP]M\b/i)?.[0];
    const date = parseMonthDayText(dateLine ?? "", context.now, context.timezone);
    if (!date) {
      continue;
    }

    const title = anchor.title;
    const description = makeDescription(blockText, title, venue);
    if (venue === "Here - After" && !isHereAfterMusicListing(title, description)) {
      continue;
    }

    listings.push({
      title,
      venue,
      date,
      time: extractTime(dateLine ?? ""),
      url: anchor.href,
      description
    });
    seenUrls.add(anchor.href);
  }

  return listings;
}

export function parseCrocodile(html: string, context: ParserContext): ParserResult {
  const todayKey = getTonightKey(context.now, context.timezone);
  const listings = extractCrocodileListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  let candidateCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.title}|${listing.venue}|${listing.date}|${listing.time ?? ""}|${listing.url}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.title,
      venue: listing.venue,
      date: listing.date,
      time: listing.time,
      location: VENUE_DETAILS[listing.venue].location,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from The Crocodile public TicketWeb organization calendar",
        "included The Crocodile and Madame Lou's listings",
        "included Here-After only when title details had explicit music signals",
        "excluded Hotel Crocodile, Baba Yaga, already-tracked outside venues, cancelled listings, and unrelated partner venues"
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
        ? "parsed The Crocodile public TicketWeb organization calendar with explicit venue filtering"
        : "The Crocodile TicketWeb calendar fetched, but no current included venue rows were recognized"
  };
}
