import { createHash } from "node:crypto";

import { cleanDisplayText, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import { normalizePublicImageUrl } from "../imageUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const WIX_WARMUP_DATA_ID = "wix-warmup-data";
const SEA_MONSTER_LOCATION = "2202 N 45th St, Seattle, WA 98103";

type WixEvent = {
  id?: string;
  title?: string;
  description?: string;
  slug?: string;
  status?: number;
  location?: {
    name?: string;
    address?: string;
    fullAddress?: {
      formattedAddress?: string;
    };
  };
  scheduling?: {
    config?: {
      startDate?: string;
      endDate?: string;
      timeZoneId?: string;
    };
    startTimeFormatted?: string;
    formatted?: string;
  };
};

type SeaMonsterListing = {
  id: string;
  title: string;
  date: string;
  time?: string;
  location: string;
  description?: string;
  url: string;
  status?: number;
  imageUrl?: string;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function extractWarmupDataJson(html: string): string | undefined {
  const match = html.match(
    new RegExp(`<script[^>]+id=["']${WIX_WARMUP_DATA_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i")
  );
  return match?.[1];
}

function collectWixEventArrays(value: unknown, matches: WixEvent[][]): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectWixEventArrays(item, matches);
    }
    return;
  }

  const object = value as Record<string, unknown>;
  const eventsContainer = object.events;

  if (
    eventsContainer
    && typeof eventsContainer === "object"
    && Array.isArray((eventsContainer as Record<string, unknown>).events)
  ) {
    const events = (eventsContainer as Record<string, unknown>).events as unknown[];
    if (events.some((event) => isWixEvent(event))) {
      matches.push(events.filter(isWixEvent));
    }
  }

  for (const item of Object.values(object)) {
    collectWixEventArrays(item, matches);
  }
}

function isWixEvent(value: unknown): value is WixEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as WixEvent;
  return typeof event.title === "string" && typeof event.scheduling?.config?.startDate === "string";
}

function formatDateKeyFromIso(value: string, timezone: string): string | undefined {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function buildEventUrl(event: WixEvent, sourceUrl: string): string {
  const slug = cleanDisplayText(event.slug);
  if (!slug) {
    return sourceUrl;
  }

  return new URL(`/event-info/${slug}`, sourceUrl).toString();
}

function collectGenreHints(event: WixEvent): string[] {
  const hints = new Set<string>(["live music", "concert", "funk", "soul", "jazz", "Wallingford club", "SeaMonster Lounge"]);
  const blob = `${event.title ?? ""} ${event.description ?? ""}`.toLowerCase();
  const keywordPairs: Array<[string, string]> = [
    ["funk", "funk"],
    ["soul", "soul"],
    ["jazz", "jazz"],
    ["latin", "latin"],
    ["salsa", "salsa"],
    ["afrobeat", "afrobeat"],
    ["brass", "brass"],
    ["organ", "organ"],
    ["trio", "trio"],
    ["band", "band"],
    ["improvis", "improvisation"],
    ["rock", "rock"],
    ["punk", "punk"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function findPublicImageUrl(value: unknown, sourceUrl: string): string | undefined {
  if (typeof value === "string") {
    const normalized = normalizePublicImageUrl(value, sourceUrl);
    if (normalized && /(?:\.(?:jpe?g|png|webp)(?:\?|$)|static\.wixstatic\.com|static\.parastorage\.com)/i.test(normalized)) {
      return normalized;
    }

    return undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = findPublicImageUrl(item, sourceUrl);
      if (imageUrl) {
        return imageUrl;
      }
    }

    return undefined;
  }

  for (const [key, item] of Object.entries(value)) {
    if (!/image|photo|media|thumbnail|poster|url/i.test(key)) {
      continue;
    }

    const imageUrl = findPublicImageUrl(item, sourceUrl);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return undefined;
}

function normalizeWixEvent(event: WixEvent, context: ParserContext): SeaMonsterListing | undefined {
  const title = cleanDisplayText(event.title);
  const startDate = cleanDisplayText(event.scheduling?.config?.startDate);
  const date = formatDateKeyFromIso(startDate, context.timezone);

  if (!title || !date) {
    return undefined;
  }

  const description = cleanDisplayText(stripHtml(event.description ?? ""));
  const location =
    cleanDisplayText(event.location?.fullAddress?.formattedAddress)
    || cleanDisplayText(event.location?.address)
    || SEA_MONSTER_LOCATION;
  const url = buildEventUrl(event, context.source.url);

  return {
    id: makeId(`${event.id ?? title}|${startDate}|${url}`),
    title,
    date,
    time: cleanDisplayText(event.scheduling?.startTimeFormatted) || undefined,
    location,
    description: description || undefined,
    url,
    status: event.status,
    imageUrl: findPublicImageUrl(event, context.source.url)
  };
}

export function extractSeaMonsterListings(html: string, context: ParserContext): SeaMonsterListing[] {
  const warmupJson = extractWarmupDataJson(html);
  if (!warmupJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(warmupJson) as unknown;
    const eventArrays: WixEvent[][] = [];
    collectWixEventArrays(parsed, eventArrays);
    const seen = new Set<string>();
    const listings: SeaMonsterListing[] = [];

    for (const event of eventArrays.flat()) {
      const listing = normalizeWixEvent(event, context);

      if (!listing || seen.has(listing.id)) {
        continue;
      }

      listings.push(listing);
      seen.add(listing.id);
    }

    return listings;
  } catch {
    return [];
  }
}

export function parseSeaMonster(html: string, context: ParserContext): ParserResult {
  const listings = extractSeaMonsterListings(html, context);

  const events: LiveMusicEvent[] = listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    artist: listing.title,
    venue: context.source.name,
    date: listing.date,
    time: listing.time,
    location: listing.location,
    url: listing.url,
    sourceName: context.source.name,
    genreHints: collectGenreHints({
      title: listing.title,
      description: listing.description
    }),
    description: listing.description,
    imageUrl: listing.imageUrl,
    imageAlt: listing.imageUrl ? `${listing.title} event image` : undefined,
    confidence: "High",
    basis: normalizeWhitespace([
      "Parsed from SeaMonster Lounge official public Wix Events listings",
      listing.status !== undefined ? `Wix event status ${listing.status}` : undefined,
      "venue fit suggests live funk, soul, jazz, Latin, organ, brass, improv, and local club shows"
    ].filter(Boolean).join("; "))
  }));

  return {
    events,
    candidateCount: listings.length,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      events.length > 0
        ? "parsed SeaMonster Lounge events from official public Wix Events listings"
        : "SeaMonster Lounge page fetched, but no public Wix Events listings were found"
  };
}
