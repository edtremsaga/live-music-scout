import { createHash } from "node:crypto";

import { cleanDisplayText, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const KEXP_BASE_URL = "https://www.kexp.org";
const KEXP_STUDIO_LOCATION = "KEXP Studio (NW Rooms), Seattle, WA";

type KexpListing = {
  title: string;
  originalTitle: string;
  date: string;
  venue: string;
  location: string;
  url: string;
};

type KexpDetail = {
  time?: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function extractFirst(pattern: RegExp, value: string): string | undefined {
  return value.match(pattern)?.[1];
}

function toAbsoluteKexpUrl(url: string): string {
  return url.startsWith("http")
    ? url
    : new URL(url, KEXP_BASE_URL).toString();
}

function cleanKexpTitle(title: string): string {
  return cleanDisplayText(title)
    .replace(/\s+LIVE on KEXP\s+\(OPEN TO THE PUBLIC\)/i, "")
    .replace(/\s+\(OPEN TO THE PUBLIC\)/i, "")
    .trim();
}

function splitVenueAndLocation(subtitle: string): Pick<KexpListing, "venue" | "location"> {
  const [venueText, addressText] = subtitle.split(/\s*\/\/\s*/, 2).map(cleanDisplayText);

  if (addressText) {
    return {
      venue: venueText,
      location: addressText
    };
  }

  if (/KEXP Studio/i.test(venueText)) {
    return {
      venue: venueText,
      location: KEXP_STUDIO_LOCATION
    };
  }

  return {
    venue: venueText || "KEXP Event",
    location: venueText || "Seattle, WA"
  };
}

function isBroadcastOnlyRow(title: string, subtitle: string): boolean {
  const blob = `${title} ${subtitle}`.toLowerCase();

  return (
    blob.includes("on the air")
    || blob.includes("worldwide at kexp.org")
    || blob.includes("broadcast only")
  ) && !blob.includes("open to the public");
}

function isPublicInPersonRow(title: string, subtitle: string): boolean {
  if (isBroadcastOnlyRow(title, subtitle)) {
    return false;
  }

  return /open to the public/i.test(title)
    || subtitle.includes("//")
    || /KEXP Studio|Laser Dome|Pacific Science Center/i.test(subtitle);
}

function isSeattleKexpListing(listing: Pick<KexpListing, "venue" | "location">): boolean {
  const blob = `${listing.venue} ${listing.location}`.toLowerCase();

  return blob.includes("seattle")
    || blob.includes("kexp studio")
    || blob.includes("pacific science center");
}

export function extractKexpListings(html: string, context: ParserContext): KexpListing[] {
  const listings: KexpListing[] = [];
  const rowMatches = html.matchAll(/<div class="ListCard-row">([\s\S]*?)(?=<\/div>\s*(?:<hr>|<\/div>|<div class="ListCard-row">))/gi);

  for (const match of rowMatches) {
    const row = match[1];
    const dateText = cleanDisplayText(extractFirst(/<span class="ListCard-value">([\s\S]*?)<\/span>/i, row));
    const href = extractFirst(/<a href="([^"]+)" class="ListCard-title">/i, row);
    const originalTitle = cleanDisplayText(extractFirst(/class="ListCard-title">([\s\S]*?)<\/a>/i, row));
    const subtitle = cleanDisplayText(stripHtml(extractFirst(/class="ListCard-subtitle"[^>]*>([\s\S]*?)<\/a>/i, row) ?? ""));
    const date = parseMonthDayText(dateText, context.now, context.timezone);

    if (!date || !href || !originalTitle || !subtitle || !isPublicInPersonRow(originalTitle, subtitle)) {
      continue;
    }

    const venueLocation = splitVenueAndLocation(subtitle);

    const listing = {
      originalTitle,
      title: cleanKexpTitle(originalTitle) || originalTitle,
      date,
      url: toAbsoluteKexpUrl(href),
      ...venueLocation
    };

    if (!isSeattleKexpListing(listing)) {
      continue;
    }

    listings.push(listing);
  }

  return listings;
}

function formatKexpTimeFromCalendar(value: string | undefined): string | undefined {
  const match = cleanDisplayText(value).match(/\b\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,2}):(\d{2})\b/);

  if (!match) {
    return undefined;
  }

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return `${hour12}:${minute} ${meridiem}`;
}

export function extractKexpDetail(html: string): KexpDetail {
  const calendarStart = extractFirst(/<span class="start">\s*([\s\S]*?)\s*<\/span>/i, html);
  const lead = cleanDisplayText(stripHtml(extractFirst(/<div class="lead u-h4">([\s\S]*?)<\/div>/i, html) ?? ""));
  const content = cleanDisplayText(stripHtml(extractFirst(/<div class="content">([\s\S]*?)<\/div>/i, html) ?? ""));
  const description = normalizeWhitespace([lead, content].filter(Boolean).join(" "));

  return {
    time: formatKexpTimeFromCalendar(calendarStart),
    description: description || undefined
  };
}

async function fetchKexpDetail(url: string): Promise<KexpDetail> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "LiveMusicScout/0.1 (+local CLI prototype)"
    }
  });

  if (!response.ok) {
    return {};
  }

  return extractKexpDetail(await response.text());
}

function collectGenreHints(listing: KexpListing): string[] {
  const hints = new Set<string>([
    "concert",
    "live music",
    "KEXP public event",
    "strong local musicianship"
  ]);
  const blob = `${listing.title} ${listing.originalTitle} ${listing.venue}`.toLowerCase();

  if (blob.includes("studio")) {
    hints.add("public in-studio performance");
  }

  if (blob.includes("laser")) {
    hints.add("music and visual event");
  }

  return [...hints];
}

export async function parseKexp(html: string, context: ParserContext): Promise<ParserResult> {
  const listings = extractKexpListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    const detail = await fetchKexpDetail(listing.url);
    const dedupeKey = `${listing.title}|${listing.date}|${detail.time ?? ""}|${listing.url}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.title,
      venue: listing.venue,
      date: listing.date,
      time: detail.time,
      location: listing.location,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: detail.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from KEXP public events page rows",
        detail.time ? `public detail page includes start time ${detail.time}` : "time was not clearly extracted from the public detail page",
        "parser skips broadcast-only/on-air rows unless they are marked open to the public"
      ].join("; "))
    });

    seenKeys.add(dedupeKey);
  }

  return {
    events,
    candidateCount: listings.length,
    uncertainCount: 0,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      listings.length > 0
        ? "parsed public in-person KEXP event rows"
        : "KEXP events page fetched but no public in-person event rows were recognized"
  };
}
