import { createHash } from "node:crypto";

import { cleanDisplayText, extractTime, getTonightKey, normalizeWhitespace, parseMonthDayText, stripHtml } from "../dateUtils.js";
import { normalizePublicImageUrl } from "../imageUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const SHOWBOX_MARKET_LOCATION = "1426 1st Ave, Seattle, WA 98101";
const SHOWBOX_SODO_LOCATION = "1700 1st Ave S, Seattle, WA 98134";

type ShowboxListing = {
  title: string;
  date: string;
  time?: string;
  venue: "Showbox at the Market" | "Showbox SoDo";
  location: string;
  url: string;
  description?: string;
  imageUrl?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function getAttribute(tag: string | undefined, name: string): string | undefined {
  return tag?.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"))?.[2]?.replace(/&amp;/g, "&");
}

function toAbsoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value.replace(/&amp;/g, "&"), baseUrl).toString();
  } catch {
    return undefined;
  }
}

function normalizeVenue(value: string): Pick<ShowboxListing, "venue" | "location"> | undefined {
  if (value === "The Showbox") {
    return { venue: "Showbox at the Market", location: SHOWBOX_MARKET_LOCATION };
  }

  if (value === "Showbox SoDo") {
    return { venue: "Showbox SoDo", location: SHOWBOX_SODO_LOCATION };
  }

  return undefined;
}

function extractIconSpanText(block: string, className: string): string {
  const match = block.match(new RegExp(`<span\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/span>\\s*([^<]+)<\\/span>`, "i"));
  return cleanDisplayText(match?.[1] ?? "");
}

function extractImageUrl(block: string, context: ParserContext): string | undefined {
  const imageTag = block.match(/<img\b[^>]*>/i)?.[0];
  const rawUrl = getAttribute(imageTag, "src") ?? getAttribute(imageTag, "data-src");
  const imageUrl = normalizePublicImageUrl(rawUrl, context.source.url);

  if (!imageUrl || imageUrl.includes("default_thumb") || imageUrl.includes("/assets/img/")) {
    return undefined;
  }

  return imageUrl;
}

function collectGenreHints(listing: ShowboxListing): string[] {
  const blob = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["concert", "touring acts", "Seattle rock venue", listing.venue]);

  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["indie", "indie rock"],
    ["pop", "pop"],
    ["hip hop", "hip-hop"],
    ["rap", "hip-hop"],
    ["electronic", "electronic"],
    ["dj", "DJ"],
    ["tour", "touring act"],
    ["with ", "supporting artists"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

export function extractShowboxPresentsListings(html: string, context: ParserContext): ShowboxListing[] {
  const blocks = html.split(/<div\b[^>]*class="[^"]*\bentry\b[^"]*"[^>]*>/i).slice(1);
  const listings: ShowboxListing[] = [];

  for (const block of blocks) {
    const detailAnchor = block.match(/<h3\b[^>]*class="[^"]*\bcarousel_item_title_small\b[^"]*"[^>]*>[\s\S]*?<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i);
    const title = cleanDisplayText(stripHtml(detailAnchor?.[3] ?? ""));
    const url = toAbsoluteUrl(detailAnchor?.[2], context.source.url);
    const venueText = extractIconSpanText(block, "venue");
    const venue = normalizeVenue(venueText);
    const dateText = extractIconSpanText(block, "date");
    const date = parseMonthDayText(dateText, context.now, context.timezone);

    if (!title || !url || !venue || !date) {
      continue;
    }

    const timeText = extractIconSpanText(block, "time");
    const presenter = cleanDisplayText(stripHtml(block.match(/<h5\b[^>]*class="[^"]*\baccentColor\b[^"]*"[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? ""));
    const subtitleMatches = [...block.matchAll(/<h5\b(?![^>]*\baccentColor\b)[^>]*>([\s\S]*?)<\/h5>/gi)]
      .map((match) => cleanDisplayText(stripHtml(match[1])))
      .filter(Boolean);
    const support = cleanDisplayText(stripHtml(block.match(/<h4\b[^>]*class="[^"]*\banimated\b[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? ""));
    const description = [presenter, ...subtitleMatches, support].filter(Boolean).join("; ") || undefined;

    listings.push({
      title,
      date,
      time: extractTime(timeText),
      ...venue,
      url,
      description,
      imageUrl: extractImageUrl(block, context)
    });
  }

  return listings;
}

export function parseShowboxPresents(html: string, context: ParserContext): ParserResult {
  const todayKey = getTonightKey(context.now, context.timezone);
  const listings = extractShowboxPresentsListings(html, context);
  const events: LiveMusicEvent[] = [];
  const seenKeys = new Set<string>();
  let candidateCount = 0;

  for (const listing of listings) {
    if (listing.date < todayKey) {
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
      artist: listing.title,
      venue: listing.venue,
      date: listing.date,
      time: listing.time,
      location: listing.location,
      url: listing.url,
      sourceName: context.source.name,
      genreHints: collectGenreHints(listing),
      description: listing.description,
      imageUrl: listing.imageUrl,
      imageAlt: listing.imageUrl ? `${listing.title} event image` : undefined,
      confidence: "High",
      basis: normalizeWhitespace([
        "Parsed from Showbox Presents public event cards",
        listing.time ? `listing includes show time ${listing.time}` : "time was not clearly extracted",
        `venue filter matched ${listing.venue}`
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
        ? "parsed Showbox Presents public event cards for The Showbox and Showbox SoDo"
        : "Showbox Presents page fetched but no Showbox venue event cards were recognized"
  };
}
