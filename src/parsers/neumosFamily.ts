import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const NEUMOS_LOCATION = "925 East Pike Street, Seattle, WA 98122";
const BARBOZA_LOCATION = "925 East Pike Street, Seattle, WA 98122";

type NeumosFamilyListing = {
  title: string;
  date: string;
  time?: string;
  venue: "Neumos" | "Barboza";
  location: string;
  url: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function parseDateLabel(value: string): string | undefined {
  const candidate = new Date(cleanDisplayText(value).replace(/\s+/g, " "));

  if (Number.isNaN(candidate.getTime())) {
    return undefined;
  }

  const year = candidate.getFullYear();
  const month = `${candidate.getMonth() + 1}`.padStart(2, "0");
  const day = `${candidate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function venueForSource(context: ParserContext): "Neumos" | "Barboza" {
  return context.source.name === "Barboza" ? "Barboza" : "Neumos";
}

function toAbsoluteUrl(url: string, context: ParserContext): string {
  return url.startsWith("http")
    ? url
    : new URL(url, context.source.url).toString();
}

function locationForVenue(venue: "Neumos" | "Barboza"): string {
  return venue === "Barboza" ? BARBOZA_LOCATION : NEUMOS_LOCATION;
}

function collectGenreHints(listing: NeumosFamilyListing): string[] {
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const hints = new Set<string>([
    "live music",
    "concert",
    "Capitol Hill club",
    listing.venue
  ]);

  const keywordPairs: Array<[string, string]> = [
    ["album release", "album release"],
    ["record release", "album release"],
    ["release party", "album release"],
    ["tour", "touring act"],
    ["band", "live bands"],
    ["with ", "supporting artists"],
    ["dj", "DJ"],
    ["dance", "dance night"],
    ["indie", "indie rock"],
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["soul", "soul"],
    ["funk", "funk"],
    ["hip hop", "hip-hop"],
    ["rap", "hip-hop"],
    ["singer-songwriter", "singer-songwriter"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function firstMatch(block: string, pattern: RegExp): string | undefined {
  return block.match(pattern)?.[1];
}

function cleanOptionalHtml(value: string | undefined): string | undefined {
  const cleaned = value ? normalizeWhitespace(stripHtml(value)) : "";
  return cleaned || undefined;
}

function extractDisplayedVenue(block: string): string | undefined {
  return cleanOptionalHtml(firstMatch(block, /<div[^>]*class="[^"]*\bvenue\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i));
}

function hasCrossListedVenue(block: string, configuredVenue: "Neumos" | "Barboza"): boolean {
  const otherVenue = configuredVenue === "Barboza" ? "Neumos" : "Barboza";
  return new RegExp(`>\\s*${otherVenue}\\s*<`, "i").test(block);
}

function buildDescription(parts: Array<string | undefined>): string | undefined {
  const cleanedParts = parts
    .map((part) => cleanDisplayText(part ?? ""))
    .filter(Boolean);

  return cleanedParts.length > 0 ? cleanedParts.join("; ") : undefined;
}

export function extractNeumosFamilyListings(html: string, context: ParserContext): NeumosFamilyListing[] {
  const configuredVenue = venueForSource(context);
  const blocks = html.split(/<div class="eventItem\b/i).slice(1);
  const listings: NeumosFamilyListing[] = [];

  for (const blockFragment of blocks) {
    const block = `<div class="eventItem${blockFragment}`;
    const titleMatch = block.match(/<h3[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);
    const dateText = firstMatch(block, /<div[^>]*class="[^"]*\bdate\b[^"]*"[^>]*aria-label="([^"]+)"/i);
    const timeText = cleanOptionalHtml(firstMatch(block, /<div[^>]*class="[^"]*\btime\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i));
    const displayedVenue = extractDisplayedVenue(block);

    if (!titleMatch || !dateText) {
      continue;
    }

    if ((displayedVenue && displayedVenue !== configuredVenue) || hasCrossListedVenue(block, configuredVenue)) {
      continue;
    }

    const [, url, titleHtml] = titleMatch;
    const title = normalizeWhitespace(stripHtml(titleHtml));
    const date = parseDateLabel(dateText);

    if (!title || !date) {
      continue;
    }

    const promoter = cleanOptionalHtml(firstMatch(block, /<div[^>]*class="[^"]*\bpromotion-text\b(?![^"]*\btour\b)[^"]*"[^>]*>([\s\S]*?)<\/div>/i));
    const support = cleanOptionalHtml(firstMatch(block, /<h4[^>]*class="[^"]*\btagline\b[^"]*"[^>]*>([\s\S]*?)<\/h4>/i));
    const tour = cleanOptionalHtml(firstMatch(block, /<div[^>]*class="[^"]*\bpromotion-text\b[^"]*\btour\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i));
    const age = cleanOptionalHtml(firstMatch(block, /<div[^>]*class="[^"]*\bage\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i));
    const description = buildDescription([promoter, support, tour, age]);

    listings.push({
      title,
      date,
      time: timeText ? extractTime(timeText) : undefined,
      venue: configuredVenue,
      location: locationForVenue(configuredVenue),
      url: toAbsoluteUrl(url, context),
      description
    });
  }

  return listings;
}

export function parseNeumosFamily(html: string, context: ParserContext): ParserResult {
  const todayKey = getTonightKey(context.now, context.timezone);
  const listings = extractNeumosFamilyListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  let candidateCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.venue}|${listing.title}|${listing.date}|${listing.time ?? ""}|${listing.url}`;
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
      location: listing.location,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        `Parsed from ${listing.venue} public Carbonhouse event row`,
        listing.time ? `listing includes doors time ${listing.time}` : "time was not clearly extracted",
        "venue fit suggests Capitol Hill club concerts, touring acts, and local support bills"
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
        ? `parsed ${context.source.name} public Carbonhouse event rows`
        : `${context.source.name} page fetched but no confident event rows were recognized`
  };
}
