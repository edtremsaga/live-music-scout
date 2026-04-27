import { createHash } from "node:crypto";

import { extractTime, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const SKYLARK_BASE_URL = "https://www.skylarkcafe.com";
const SKYLARK_LOCATION = "3803 Delridge Way SW, Seattle, WA 98106";

type SkylarkListing = {
  title: string;
  date: string;
  time?: string;
  description?: string;
  url: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toAbsoluteSkylarkUrl(url: string): string {
  return url.startsWith("http")
    ? url
    : new URL(url, SKYLARK_BASE_URL).toString();
}

function parseSkylarkDate(value: string): { date: string; time?: string } | undefined {
  const cleaned = normalizeWhitespace(stripHtml(value)).replace(/\s+/g, " ").trim();
  const candidate = new Date(cleaned);

  if (Number.isNaN(candidate.getTime())) {
    return undefined;
  }

  const year = candidate.getFullYear();
  const month = `${candidate.getMonth() + 1}`.padStart(2, "0");
  const day = `${candidate.getDate()}`.padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: extractTime(cleaned)
  };
}

function collectGenreHints(title: string, description?: string): string[] {
  const blob = `${title} ${description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["local bands", "west seattle", "club venue"]);

  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["indie", "indie rock"],
    ["americana", "Americana"],
    ["roots", "roots"],
    ["soul", "soul"],
    ["funk", "funk"],
    ["blues", "blues"],
    ["punk", "punk"],
    ["tribute", "tribute"],
    ["band", "live bands"],
    ["guitar", "guitar-forward"],
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

function isClearlySkippedSkylarkEvent(title: string, description?: string): boolean {
  const blob = `${title} ${description ?? ""}`.toLowerCase();

  return (
    blob.includes("trivia")
    || blob.includes("bingo")
    || blob.includes("drag")
    || blob.includes("burlesque")
    || blob.includes("comedy")
    || blob.includes("open mic")
    || blob.includes("pun slam")
    || blob.includes("karaoke")
  );
}

export function extractSkylarkListings(html: string): SkylarkListing[] {
  const listings: SkylarkListing[] = [];
  const blocks = html.split('<div role="listitem" class="collection-item-3 w-dyn-item">').slice(1);

  for (const block of blocks) {
    const titleMatch = block.match(/class="text-block-12">([\s\S]*?)<\/div>/i);
    const dateMatch = block.match(/class="date">([\s\S]*?)<\/div>/i);
    const descriptionMatch = block.match(/class="rich-text-block-10 w-richtext">([\s\S]*?)<\/div>/i);
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*class="link-block-4 w-inline-block"/i);

    if (!titleMatch || !dateMatch || !linkMatch) {
      continue;
    }

    const parsedDate = parseSkylarkDate(dateMatch[1]);
    const title = normalizeWhitespace(stripHtml(titleMatch[1]));

    if (!parsedDate || !title) {
      continue;
    }

    listings.push({
      title,
      date: parsedDate.date,
      time: parsedDate.time,
      description: descriptionMatch ? normalizeWhitespace(stripHtml(descriptionMatch[1])) : undefined,
      url: toAbsoluteSkylarkUrl(linkMatch[1])
    });
  }

  return listings;
}

export function parseSkylark(html: string, context: ParserContext): ParserResult {
  const listings = extractSkylarkListings(html);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  const todayKey = getTonightKey(context.now, context.timezone);
  let candidateCount = 0;
  let uncertainCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
      continue;
    }

    if (isClearlySkippedSkylarkEvent(listing.title, listing.description)) {
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
      venue: "Skylark Cafe",
      date: listing.date,
      time: listing.time,
      location: SKYLARK_LOCATION,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing.title, listing.description),
      description: listing.description,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Skylark Cafe upcoming event cards",
        listing.time ? `listing includes start time ${listing.time}` : "time was not clearly extracted",
        "venue fit suggests local-band bookings, indie rock, roots, and musicianship-forward club nights"
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
        ? "parsed Skylark Cafe upcoming event cards from the calendar page"
        : "Skylark Cafe page fetched but no confident live-music listings were recognized"
  };
}
