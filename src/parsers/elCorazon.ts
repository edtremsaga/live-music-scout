import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const EL_CORAZON_BASE_URL = "https://www.elcorazonseattle.com";
const EL_CORAZON_LOCATION = "109 Eastlake Avenue East, Seattle, WA 98109";

type ElCorazonListing = {
  title: string;
  artist: string;
  dateText: string;
  date?: string;
  time?: string;
  venue: string;
  url: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteElCorazonUrl(url: string): string {
  return url.startsWith("http")
    ? url
    : new URL(url, EL_CORAZON_BASE_URL).toString();
}

function getClassText(block: string, className: string): string | undefined {
  const match = block.match(new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, "i"));
  const text = match ? normalizeWhitespace(stripHtml(match[1])) : "";
  return text || undefined;
}

function getVisibleVenue(block: string): string | undefined {
  const venueSectionMatch = block.match(/<div class="venue-location">([\s\S]*?)<div class="ticket-price">/i);
  const venueSection = venueSectionMatch?.[1] ?? block;
  const venueMatches = Array.from(venueSection.matchAll(/<div[^>]*class="([^"]*\btext-block-77(?:-copy)?\b[^"]*)"[^>]*>([\s\S]*?)<\/div>/gi))
    .filter((match) => !/\bw-condition-invisible\b/.test(match[1]))
    .map((match) => cleanDisplayText(stripHtml(match[2])))
    .filter((text) => text && text.toLowerCase() !== "at" && !text.includes("$") && !/^(all ages|21\+)$/i.test(text));

  return venueMatches.at(-1);
}

function getShowTime(block: string): string | undefined {
  const showAtMatch = block.match(/Show at<\/div><div[^>]*class="[^"]*\btext-block-75\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const doorsAtMatch = block.match(/Doors at\s*<\/div><div[^>]*class="[^"]*\btext-block-75\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  return extractTime(showAtMatch?.[1] ?? doorsAtMatch?.[1] ?? "");
}

function collectGenreHints(listing: ElCorazonListing): string[] {
  const blob = `${listing.title} ${listing.artist} ${listing.description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["live music", "concert", "live bands", "club venue", listing.venue]);

  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["hardcore", "hardcore"],
    ["emo", "emo"],
    ["goth", "goth"],
    ["industrial", "industrial"],
    ["indie", "indie"],
    ["tour", "touring act"],
    ["dj", "DJ"],
    ["band", "live bands"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function isClearlySkippedListing(listing: ElCorazonListing): boolean {
  const blob = `${listing.title} ${listing.artist} ${listing.description ?? ""}`.toLowerCase();

  return (
    blob.includes("private event")
    || blob.includes("closed for")
    || blob.includes("comedy")
    || blob.includes("wrestling")
  );
}

export function extractElCorazonListings(html: string, context: ParserContext): ElCorazonListing[] {
  const blocks = html.split(/<div role="listitem" class="uui-layout88_item w-dyn-item">/).slice(1);
  const listings: ElCorazonListing[] = [];

  for (const block of blocks) {
    if (!block.includes("event-div") || !block.includes("show-details")) {
      continue;
    }

    const urlMatch = block.match(/<a href="([^"]*\/shows\/[^"]+)"/i);
    const dayMatch = block.match(/<div class="day-date">[\s\S]*?<div class="text-block-72">([\s\S]*?)<\/div><div class="text-block-72">([\s\S]*?)<\/div>/i);
    const title = getClassText(block, "event-title");
    const headliners = getClassText(block, "headliners");
    const presenter = getClassText(block, "event-presenter");
    const supports = getClassText(block, "supports");
    const venue = getVisibleVenue(block);

    if (!urlMatch || !dayMatch || !headliners || !venue) {
      continue;
    }

    const dateText = `${dayMatch[1]} ${dayMatch[2]}`;
    const parsedDate = parseMonthDayText(dateText, context.now, context.timezone);
    const artist = headliners;
    const listingTitle = title && title !== artist ? title : artist;
    const description = normalizeWhitespace([
      presenter && presenter !== listingTitle ? presenter : undefined,
      supports ? `Supporting Talent: ${supports}` : undefined
    ].filter(Boolean).join("; "));

    listings.push({
      title: listingTitle,
      artist,
      dateText,
      date: parsedDate,
      time: getShowTime(block),
      venue,
      url: toAbsoluteElCorazonUrl(urlMatch[1]),
      description: description || undefined
    });
  }

  return listings;
}

export function parseElCorazon(html: string, context: ParserContext): ParserResult {
  const listings = extractElCorazonListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;
  let uncertainCount = 0;

  for (const listing of listings) {
    if (!listing.date) {
      uncertainCount += 1;
      continue;
    }

    if (listing.date < todayKey || isClearlySkippedListing(listing)) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.title}|${listing.date}|${listing.time ?? ""}|${listing.venue}|${listing.url}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.artist,
      venue: listing.venue,
      date: listing.date,
      time: listing.time,
      location: EL_CORAZON_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from El Corazon / Funhouse public Webflow event cards",
        listing.time ? `listing includes show time ${listing.time}` : "time was not clearly extracted",
        "venue fit suggests touring rock, punk, metal, alternative, and live-band club bookings"
      ].join("; "))
    });

    seenKeys.add(dedupeKey);
  }

  return {
    events,
    candidateCount,
    uncertainCount,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      candidateCount > 0
        ? "parsed El Corazon / Funhouse public Webflow event cards"
        : "El Corazon page fetched but no confident live-music listings were recognized"
  };
}
