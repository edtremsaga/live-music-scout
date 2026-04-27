import { createHash } from "node:crypto";

import { extractTime, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const NECTAR_LOCATION = "412 N 36th St, Seattle, WA 98103";
const HIDDEN_HALL_LOCATION = "400 N 35th St, Seattle, WA 98103";

type NectarFamilyListing = {
  title: string;
  url: string;
  date: string;
  time?: string;
  venueName: string;
  venueLocation?: string;
  presenter?: string;
  supportingArtists?: string;
};

type NectarFamilyVenue = {
  displayName: "Nectar Lounge" | "Hidden Hall";
  fixedLocation: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toDateKey(monthText: string, dayText: string, yearText: string): string | undefined {
  const candidate = new Date(`${monthText} ${dayText}, ${yearText} 12:00:00`);
  if (Number.isNaN(candidate.getTime())) {
    return undefined;
  }

  const year = candidate.getFullYear();
  const month = `${candidate.getMonth() + 1}`.padStart(2, "0");
  const day = `${candidate.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function collectGenreHints(title: string, supportingArtists?: string, presenter?: string): string[] {
  const blob = `${title} ${supportingArtists ?? ""} ${presenter ?? ""}`.toLowerCase();
  const hints = new Set<string>(["live venue", "seattle venue"]);

  const keywordPairs: Array<[string, string]> = [
    ["jazz", "jazz"],
    ["blues", "blues"],
    ["soul", "soul"],
    ["funk", "funk"],
    ["americana", "Americana"],
    ["folk", "folk"],
    ["rock", "rock"],
    ["indie", "indie rock"],
    ["jam", "jam"],
    ["band", "live bands"],
    ["tribute", "tribute"],
    ["guitar", "guitar-forward"],
    ["songwriter", "singer-songwriter"],
    ["singer-songwriter", "singer-songwriter"],
    ["ska", "ska"],
    ["reggae", "reggae"],
    ["afrobeat", "afrobeat"],
    ["world", "world music"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function isClearlySkippedEvent(title: string, supportingArtists?: string, presenter?: string): boolean {
  const blob = `${title} ${supportingArtists ?? ""} ${presenter ?? ""}`.toLowerCase();

  return (
    blob.includes("private event")
    || blob.includes("private party")
    || blob.includes("trivia")
    || blob.includes("comedy")
    || blob.includes("comedian")
    || blob.includes("stand up")
    || blob.includes("burlesque")
    || blob.includes("nerdlesque")
    || blob.includes("drag")
    || blob.includes("bingo")
    || blob.includes("karaoke")
    || blob.includes("open mic")
    || blob.includes("screening")
    || blob.includes("film")
    || blob.includes("movie")
    || blob.includes("workshop")
  );
}

export function extractNectarFamilyListings(html: string): NectarFamilyListing[] {
  const listings: NectarFamilyListing[] = [];
  const blocks = html.matchAll(/<div\s+class="sg-events__event"[\s\S]*?<\/article>\s*<\/div>/gi);

  for (const match of blocks) {
    const block = match[0];
    const titleMatch = block.match(/class="sg-events__event-title-link"[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    const presenterMatch = block.match(/class="sg-events__event-top-bar"[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const supportingMatch = block.match(/class="sg-events__event-supporting-artists">([\s\S]*?)<\/h4>/i);
    const timeMatch = block.match(/class="sg-events__event-start"[\s\S]*?(\d{1,2}:\d{2}\s*[AP]M)\s*<\/time>/i);
    const venueNameMatch = block.match(/class="sg-events__event-venue-name">\s*([\s\S]*?)\s*<\/div>/i);
    const venueLocationMatch = block.match(/class="sg-events__event-venue-location">\s*([\s\S]*?)\s*<\/div>/i);
    const monthMatch = block.match(/class="sg-events__event-month">([\s\S]*?)<\/span>/i);
    const dayMatch = block.match(/class="sg-events__event-day">([\s\S]*?)<\/span>/i);
    const yearMatch = block.match(/class="sg-events__event-year">([\s\S]*?)<\/span>/i);

    if (!titleMatch || !venueNameMatch || !monthMatch || !dayMatch || !yearMatch) {
      continue;
    }

    const date = toDateKey(
      normalizeWhitespace(stripHtml(monthMatch[1])),
      normalizeWhitespace(stripHtml(dayMatch[1])),
      normalizeWhitespace(stripHtml(yearMatch[1]))
    );
    const title = normalizeWhitespace(stripHtml(titleMatch[2]));
    const venueName = normalizeWhitespace(stripHtml(venueNameMatch[1]));

    if (!date || !title || !venueName) {
      continue;
    }

    listings.push({
      title,
      url: normalizeWhitespace(titleMatch[1]),
      date,
      time: timeMatch ? extractTime(normalizeWhitespace(stripHtml(timeMatch[1]))) : undefined,
      venueName,
      venueLocation: venueLocationMatch ? normalizeWhitespace(stripHtml(venueLocationMatch[1])) : undefined,
      presenter: presenterMatch ? normalizeWhitespace(stripHtml(presenterMatch[1])) : undefined,
      supportingArtists: supportingMatch ? normalizeWhitespace(stripHtml(supportingMatch[1])) : undefined
    });
  }

  return listings;
}

function parseNectarFamilyVenue(
  html: string,
  context: ParserContext,
  venue: NectarFamilyVenue
): ParserResult {
  const listings = extractNectarFamilyListings(html);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;
  let uncertainCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    if (listing.venueName !== venue.displayName) {
      continue;
    }

    if (isClearlySkippedEvent(listing.title, listing.supportingArtists, listing.presenter)) {
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
      venue: venue.displayName,
      date: listing.date,
      time: listing.time,
      location: venue.fixedLocation,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing.title, listing.supportingArtists, listing.presenter),
      description: normalizeWhitespace(
        [listing.presenter, listing.supportingArtists].filter(Boolean).join(" — ")
      ) || undefined,
      confidence: "High",
      basis: normalizeWhitespace([
        `Parsed from ${venue.displayName} server-rendered calendar cards`,
        listing.time ? `listing includes start time ${listing.time}` : "time was not clearly extracted",
        "venue calendar shows ticketed music bookings with canonical event links"
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
        ? `parsed ${venue.displayName} calendar cards from the shared management site`
        : `${venue.displayName} page fetched but no confident live-music listings were recognized`
  };
}

export function parseNectar(html: string, context: ParserContext): ParserResult {
  return parseNectarFamilyVenue(html, context, {
    displayName: "Nectar Lounge",
    fixedLocation: NECTAR_LOCATION
  });
}

export function parseHiddenHall(html: string, context: ParserContext): ParserResult {
  return parseNectarFamilyVenue(html, context, {
    displayName: "Hidden Hall",
    fixedLocation: HIDDEN_HALL_LOCATION
  });
}
