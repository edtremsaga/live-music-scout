import { createHash } from "node:crypto";

import { getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const BAKES_PLACE_LOCATION = "155 108th Avenue Northeast Ste. 110, Bellevue, WA 98004";

type BakesPlaceListing = {
  eventId: string;
  title: string;
  startDateKey: string;
  timeText?: string;
  description?: string;
  url: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function formatDateKeyFromStart(startText: string): string | undefined {
  const match = startText.match(/^(\d{4})-(\d{2})-(\d{2})\s/);
  if (!match) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function decodeBakesUrl(url: string): string {
  if (url.startsWith("http")) {
    return url;
  }

  return url.startsWith("/")
    ? `https://bakesplacebellevue.com${url}`
    : url;
}

function collectGenreHints(title: string, description?: string): string[] {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["listening room", "eastside", "seated venue"]);

  const keywordPairs: Array<[string, string]> = [
    ["jazz", "jazz"],
    ["blues", "blues"],
    ["soul", "soul"],
    ["funk", "funk"],
    ["americana", "Americana"],
    ["folk", "folk"],
    ["rock", "rock"],
    ["tribute", "tribute"],
    ["band", "live bands"],
    ["guitar", "guitar-forward"],
    ["singer-songwriter", "singer-songwriter"],
    ["songwriter", "singer-songwriter"],
    ["pop", "pop"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function isClearlySkippedBakesPlaceEvent(title: string, description?: string): boolean {
  const blob = `${title} ${description ?? ""}`.toLowerCase();

  return (
    blob.includes("private event")
    || blob.includes("private party")
    || blob.includes("brunch") && !blob.includes("live music")
    || blob.includes("trivia")
    || blob.includes("comedy")
    || blob.includes("dj")
  );
}

export function extractBakesPlaceListings(html: string, sourceUrl: string): BakesPlaceListing[] {
  const listings: BakesPlaceListing[] = [];
  const blocks = html.split('<div class="events-holder">').slice(1);

  for (const rawBlock of blocks) {
    const block = rawBlock.split("</section></div>")[0] ?? rawBlock;
    const titleMatch = block.match(/<h2>([\s\S]*?)<\/h2>/i);
    const eventIdMatch = block.match(/data-event-id="(\d+)"/i);
    const startMatch = block.match(/<var class="atc_date_start">([^<]+)<\/var>/i);
    const descriptionMatch = block.match(/<var class="atc_description">([\s\S]*?)<\/var>/i)
      ?? block.match(/<div class="event-info-text">([\s\S]*?)<\/div><h3 class="event-time">/i);
    const timeMatch = block.match(/<h3 class="event-time">([\s\S]*?)<\/h3>/i);

    if (!titleMatch || !eventIdMatch || !startMatch) {
      continue;
    }

    const title = normalizeWhitespace(stripHtml(titleMatch[1]));
    const eventId = eventIdMatch[1];
    const startDateKey = formatDateKeyFromStart(normalizeWhitespace(startMatch[1]));
    const description = descriptionMatch ? normalizeWhitespace(stripHtml(descriptionMatch[1])) : undefined;
    const timeText = timeMatch ? normalizeWhitespace(stripHtml(timeMatch[1])) : undefined;

    if (!title || !startDateKey) {
      continue;
    }

    listings.push({
      eventId,
      title,
      startDateKey,
      timeText,
      description,
      url: decodeBakesUrl(sourceUrl)
    });
  }

  return listings;
}

export function parseBakesPlace(html: string, context: ParserContext): ParserResult {
  const listings = extractBakesPlaceListings(html, context.source.url);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;
  let uncertainCount = 0;

  for (const listing of listings) {
    if (listing.startDateKey < todayKey) {
      continue;
    }

    if (isClearlySkippedBakesPlaceEvent(listing.title, listing.description)) {
      continue;
    }

    candidateCount += 1;
    const dedupeKey = `${listing.title}|${listing.startDateKey}|${listing.timeText ?? ""}|${listing.eventId}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    if (!listing.title || !listing.startDateKey) {
      uncertainCount += 1;
      continue;
    }

    events.push({
      id: makeId(dedupeKey),
      title: listing.title,
      artist: listing.title,
      venue: "Bake's Place",
      date: listing.startDateKey,
      time: listing.timeText,
      location: BAKES_PLACE_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing.title, listing.description),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Bake's Place live music event blocks",
        listing.timeText ? `listing includes event time ${listing.timeText}` : "time was not clearly extracted",
        "venue fit suggests Eastside listening-room bookings, blues, jazz, soul, tribute acts, and musicianship-forward shows"
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
        ? "parsed Bake's Place live music event blocks from the Bellevue events page"
        : "page fetched but no confident Bake's Place live-music listings were recognized"
  };
}
