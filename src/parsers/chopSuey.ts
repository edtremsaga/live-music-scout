import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const CHOP_SUEY_LOCATION = "1325 E Madison St, Seattle, WA 98122";

type ChopSueyListing = {
  title: string;
  date: string;
  time?: string;
  url: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteUrl(url: string, context: ParserContext): string {
  return url.startsWith("http")
    ? url
    : new URL(url, context.source.url).toString();
}

function parseShortDate(value: string, context: ParserContext): string | undefined {
  const match = value.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\.(\d{1,2})\b/i);
  if (!match) {
    return undefined;
  }

  const [, monthText, dayText] = match;
  const nowYear = Number.parseInt(new Intl.DateTimeFormat("en-US", {
    timeZone: context.timezone,
    year: "numeric"
  }).format(context.now), 10);
  const nowMonth = Number.parseInt(new Intl.DateTimeFormat("en-US", {
    timeZone: context.timezone,
    month: "numeric"
  }).format(context.now), 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const year = nowMonth >= 11 && month <= 2 ? nowYear + 1 : nowYear;

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function collectGenreHints(listing: ChopSueyListing): string[] {
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const hints = new Set<string>([
    "live music",
    "concert",
    "Capitol Hill club",
    "Chop Suey"
  ]);

  const keywordPairs: Array<[string, string]> = [
    ["album release", "album release"],
    ["ep release", "album release"],
    ["record release", "album release"],
    ["showcase", "showcase"],
    ["with ", "supporting artists"],
    ["dance party", "dance party"],
    ["club night", "club night"],
    ["dj", "DJ"],
    ["indie", "indie rock"],
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["hip hop", "hip-hop"],
    ["rap", "hip-hop"],
    ["disco", "disco"],
    ["house", "house"],
    ["comedy", "comedy"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function extractShowTime(text: string): string | undefined {
  const showMatch = text.match(/\bShow:\s*(\d{1,2}(?::\d{2})?\s*[AP]M)\b/i);
  if (showMatch) {
    return extractTime(showMatch[1]);
  }

  const doorsMatch = text.match(/\bDoors:\s*(\d{1,2}(?::\d{2})?\s*[AP]M)\b/i);
  return doorsMatch ? extractTime(doorsMatch[1]) : undefined;
}

export function extractChopSueyListings(html: string, context: ParserContext): ChopSueyListing[] {
  const titleAnchors = [...html.matchAll(/<a\b[^>]*href="([^"]*\/tm-event\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      href: match[1],
      title: normalizeWhitespace(stripHtml(match[2]))
    }))
    .filter((anchor) => anchor.title && !/^image\b/i.test(anchor.title));

  const listings: ChopSueyListing[] = [];
  const seenUrls = new Set<string>();

  for (let index = 0; index < titleAnchors.length; index += 1) {
    const anchor = titleAnchors[index];
    const nextAnchor = titleAnchors[index + 1];

    if (seenUrls.has(anchor.href)) {
      continue;
    }

    const blockEnd = nextAnchor?.index ?? html.search(/<h\d[^>]*>\s*Venue Address\s*<\/h\d>/i);
    const block = html.slice(anchor.index, blockEnd > anchor.index ? blockEnd : undefined);
    const blockText = cleanDisplayText(stripHtml(block));
    const date = parseShortDate(blockText, context);

    if (!date) {
      continue;
    }

    const time = extractShowTime(blockText);
    const description = cleanDisplayText(blockText
      .replace(anchor.title, "")
      .replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\.\d{1,2}\b/i, "")
      .replace(/\*+/g, " "));

    listings.push({
      title: anchor.title,
      date,
      time,
      url: toAbsoluteUrl(anchor.href, context),
      description: description || undefined
    });
    seenUrls.add(anchor.href);
  }

  return listings;
}

export function parseChopSuey(html: string, context: ParserContext): ParserResult {
  const todayKey = getTonightKey(context.now, context.timezone);
  const listings = extractChopSueyListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
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
      venue: "Chop Suey",
      date: listing.date,
      time: listing.time,
      location: CHOP_SUEY_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Chop Suey public TicketWeb-powered venue event rows",
        listing.time ? `listing includes show time ${listing.time}` : "time was not clearly extracted",
        "venue fit suggests Capitol Hill club concerts, local bills, touring acts, and some dance-party listings"
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
        ? "parsed Chop Suey public TicketWeb-powered event rows"
        : "Chop Suey page fetched but no confident event rows were recognized"
  };
}
