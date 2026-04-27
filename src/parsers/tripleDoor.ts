import { createHash } from "node:crypto";

import { extractTime, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import { fetchPage } from "../fetchPage.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const TRIPLE_DOOR_BASE_URL = "https://thetripledoor.net";
const TRIPLE_DOOR_LOCATION = "216 Union Street, Seattle, WA 98101";
const UPCOMING_CALENDAR_FEATURE_ID = "906435";
const MAX_TRIPLE_DOOR_PAGES = 5;

type TripleDoorListing = {
  title: string;
  url: string;
  dateText: string;
  time?: string;
  location: string;
  description?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteTripleDoorUrl(url: string): string {
  if (url.startsWith("http")) {
    return url;
  }

  return new URL(url, TRIPLE_DOOR_BASE_URL).toString();
}

function buildTripleDoorPageUrl(page: number): string {
  if (page <= 1) {
    return `${TRIPLE_DOOR_BASE_URL}/mainstage-calendar`;
  }

  return `${TRIPLE_DOOR_BASE_URL}/calendar_features?calendar_feature_id=${UPCOMING_CALENDAR_FEATURE_ID}&calendar_page=${page}`;
}

function collectGenreHints(title: string, description?: string): string[] {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["listening room", "seated venue", "musicianship"]);

  const keywordPairs: Array<[string, string]> = [
    ["jazz", "jazz"],
    ["blues", "blues"],
    ["soul", "soul"],
    ["funk", "funk"],
    ["americana", "Americana"],
    ["folk", "folk"],
    ["rock", "rock"],
    ["world", "world music"],
    ["singer-songwriter", "singer-songwriter"],
    ["songwriter", "singer-songwriter"],
    ["trio", "trio"],
    ["quartet", "quartet"],
    ["quintet", "quintet"],
    ["band", "live bands"],
    ["guitar", "guitar-forward"],
    ["piano", "piano-forward"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function isClearlySkippedTripleDoorEvent(title: string, location: string, description?: string): boolean {
  const titleLower = title.toLowerCase();
  const blob = `${title} ${description ?? ""}`.toLowerCase();

  if (!location.toLowerCase().includes("mainstage theatre")) {
    return true;
  }

  if (
    titleLower.includes("closed for a private event")
    || titleLower.includes("private event")
    || blob.includes("burlesque")
    || blob.includes("boylesque")
    || blob.includes("magic across america")
    || blob.includes("magician")
    || blob.includes("screening")
    || blob.includes("film")
    || blob.includes("movie")
  ) {
    return true;
  }

  return false;
}

export function extractTripleDoorListings(html: string): TripleDoorListing[] {
  const blocks = html.matchAll(/<div class="event-detail"[\s\S]*?<\/article>/gi);
  const listings: TripleDoorListing[] = [];

  for (const match of blocks) {
    const block = match[0];
    const titleMatch = block.match(/<h2 class="event-info event-title heading-tertiary"><a href="([^"]+)">([\s\S]*?)<\/a><\/h2>/i);
    const locationMatch = block.match(/<p class="event-info event-location">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const dateMatch = block.match(/<span class="date">([^<]+)<\/span>\s*@\s*<span class="time">([^<]+)<\/span>/i)
      ?? block.match(/<span class="date">([^<]+)<\/span>/i);
    const descriptionMatch = block.match(/<div class="event-info event-notes">([\s\S]*?)<\/div>/i);

    if (!titleMatch || !locationMatch || !dateMatch) {
      continue;
    }

    const title = normalizeWhitespace(stripHtml(titleMatch[2]));
    const url = toAbsoluteTripleDoorUrl(titleMatch[1]);
    const location = normalizeWhitespace(stripHtml(locationMatch[1]));
    const dateText = normalizeWhitespace(stripHtml(dateMatch[1]));
    const time = dateMatch[2] ? extractTime(normalizeWhitespace(stripHtml(dateMatch[2]))) : undefined;
    const description = descriptionMatch ? normalizeWhitespace(stripHtml(descriptionMatch[1])) : undefined;

    if (!title || !dateText || !location) {
      continue;
    }

    listings.push({
      title,
      url,
      dateText,
      time,
      location,
      description
    });
  }

  return listings;
}

export async function parseTripleDoor(html: string, context: ParserContext): Promise<ParserResult> {
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  let candidateCount = 0;
  let uncertainCount = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= MAX_TRIPLE_DOOR_PAGES; page += 1) {
    const pageUrl = buildTripleDoorPageUrl(page);
    const pageHtml = page === 1
      ? html
      : await fetchPage(pageUrl);
    const listings = extractTripleDoorListings(pageHtml);
    pagesFetched += 1;

    if (listings.length === 0) {
      break;
    }

    let allBeyondBufferWindow = true;

    for (const listing of listings) {
      const parsedDate = parseMonthDayText(listing.dateText, context.now, context.timezone);

      if (!parsedDate) {
        uncertainCount += 1;
        continue;
      }

      const candidateDate = new Date(`${parsedDate}T12:00:00Z`);
      const horizonDate = new Date(context.now);
      horizonDate.setUTCDate(horizonDate.getUTCDate() + 14);

      if (candidateDate <= horizonDate) {
        allBeyondBufferWindow = false;
      }

      if (isClearlySkippedTripleDoorEvent(listing.title, listing.location, listing.description)) {
        continue;
      }

      candidateCount += 1;
      const dedupeKey = `${listing.title}|${parsedDate}|${listing.time ?? ""}|${listing.url}`;
      if (seenKeys.has(dedupeKey)) {
        continue;
      }

      events.push({
        id: makeId(dedupeKey),
        title: listing.title,
        artist: listing.title,
        venue: "The Triple Door",
        date: parsedDate,
        time: listing.time,
        location: TRIPLE_DOOR_LOCATION,
        url: listing.url,
        sourceName: context.source.name,
        genreHints: collectGenreHints(listing.title, listing.description),
        description: listing.description,
        confidence: "High",
        basis: normalizeWhitespace([
          "Parsed from The Triple Door mainstage upcoming listings",
          listing.time ? `listing includes start time ${listing.time}` : "time was not clearly extracted",
          "venue fit suggests seated listening-room shows, touring acts, and musicianship-forward bookings"
        ].join("; "))
      });

      seenKeys.add(dedupeKey);
    }

    if (allBeyondBufferWindow) {
      break;
    }
  }

  return {
    events,
    candidateCount,
    uncertainCount,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      candidateCount > 0
        ? `parsed Triple Door mainstage upcoming listings across ${pagesFetched} page${pagesFetched === 1 ? "" : "s"}`
        : "page fetched but no confident Triple Door mainstage music listings were recognized"
  };
}
