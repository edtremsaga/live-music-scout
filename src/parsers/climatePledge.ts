import { createHash } from "node:crypto";

import { cleanDisplayText, getTonightKey, normalizeWhitespace } from "../dateUtils.js";
import { normalizePublicImageUrl } from "../imageUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const CLIMATE_PLEDGE_LOCATION = "334 1st Ave N, Seattle, WA 98109";

type TicketmasterJsonLdEvent = {
  "@type"?: string | string[];
  url?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  startDate?: string;
  eventStatus?: string;
  location?: {
    name?: string;
  };
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function getEventTypes(event: TicketmasterJsonLdEvent): string[] {
  const value = event["@type"];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function isMusicEvent(event: TicketmasterJsonLdEvent): boolean {
  return getEventTypes(event).includes("MusicEvent");
}

function isClimatePledgeEvent(event: TicketmasterJsonLdEvent): boolean {
  return cleanDisplayText(event.location?.name).toLowerCase() === "climate pledge arena";
}

function isAddOnOrPass(event: TicketmasterJsonLdEvent): boolean {
  const blob = `${event.name ?? ""} ${event.description ?? ""} ${event.url ?? ""}`.toLowerCase();
  const blockedSignals = [
    /\badd-?on\b/,
    /\bvip upgrade\b/,
    /\bevent ticket sold separately\b/,
    /\bparking\b/,
    /\bsuites?\b/,
    /\bpasses?\b/,
    /\bpre-?show\b/,
    /\bstargazer\b/,
    /\barena tour\b/,
    /\ball access\b/
  ];

  return blockedSignals.some((signal) => signal.test(blob));
}

function parseDate(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function parseTime(value: string | undefined): string | undefined {
  const match = value?.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return undefined;
  }

  const hour24 = Number(match[1]);
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${match[2]} ${suffix}`;
}

function collectGenreHints(event: TicketmasterJsonLdEvent): string[] {
  const blob = `${event.name ?? ""} ${event.description ?? ""}`.toLowerCase();
  const hints = new Set<string>(["large arena concert", "Ticketmaster MusicEvent", "Climate Pledge Arena"]);
  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["pop", "pop"],
    ["country", "country"],
    ["rap", "hip-hop"],
    ["hip hop", "hip-hop"],
    ["r&b", "R&B"],
    ["soul", "soul"],
    ["jazz", "jazz"],
    ["latin", "Latin"],
    ["tour", "touring act"],
    ["world tour", "touring act"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function extractJsonLdBlocks(html: string): string[] {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function collectJsonLdEvents(value: unknown, events: TicketmasterJsonLdEvent[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdEvents(item, events);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const candidate = value as TicketmasterJsonLdEvent;
  if (candidate.name && candidate.startDate && candidate.url && candidate["@type"]) {
    events.push(candidate);
  }

  for (const item of Object.values(value)) {
    if (typeof item === "object") {
      collectJsonLdEvents(item, events);
    }
  }
}

export function extractClimatePledgeJsonLdEvents(html: string): TicketmasterJsonLdEvent[] {
  const events: TicketmasterJsonLdEvent[] = [];

  for (const block of extractJsonLdBlocks(html)) {
    try {
      collectJsonLdEvents(JSON.parse(block) as unknown, events);
    } catch {
      continue;
    }
  }

  return events;
}

export function normalizeClimatePledgeEvent(event: TicketmasterJsonLdEvent, context: ParserContext): LiveMusicEvent | undefined {
  if (!isMusicEvent(event) || !isClimatePledgeEvent(event) || isAddOnOrPass(event)) {
    return undefined;
  }

  const title = cleanDisplayText(event.name);
  const date = parseDate(event.startDate);
  const url = cleanDisplayText(event.url);

  if (!title || !date || !url) {
    return undefined;
  }

  const description = cleanDisplayText(event.description);
  const dedupeKey = `${title}|${date}|${event.startDate ?? ""}|${url}`;
  const rawImage = Array.isArray(event.image) ? event.image[0] : event.image;
  const imageUrl = normalizePublicImageUrl(rawImage, context.source.url);

  return {
    id: makeId(dedupeKey),
    title,
    artist: title,
    venue: "Climate Pledge Arena",
    date,
    time: parseTime(event.startDate),
    location: CLIMATE_PLEDGE_LOCATION,
    url,
    sourceName: context.source.name,
    genreHints: collectGenreHints(event),
    description: description || undefined,
    imageUrl,
    imageAlt: imageUrl ? `${title} event image` : undefined,
    confidence: "High",
    basis: normalizeWhitespace([
      "Parsed from Ticketmaster public JSON-LD for Climate Pledge Arena",
      "strictly accepted schema.org MusicEvent entries",
      "sports, comedy/theater, add-ons, passes, suites, parking, and arena tours are excluded"
    ].join("; "))
  };
}

export function parseClimatePledge(html: string, context: ParserContext): ParserResult {
  const todayKey = getTonightKey(context.now, context.timezone);
  const jsonLdEvents = extractClimatePledgeJsonLdEvents(html);
  const events: LiveMusicEvent[] = [];
  const seenIds = new Set<string>();
  let candidateCount = 0;

  for (const jsonLdEvent of jsonLdEvents) {
    const event = normalizeClimatePledgeEvent(jsonLdEvent, context);

    if (!event) {
      continue;
    }

    if (event.date < todayKey) {
      continue;
    }

    candidateCount += 1;

    if (seenIds.has(event.id)) {
      continue;
    }

    events.push(event);
    seenIds.add(event.id);
  }

  return {
    events,
    candidateCount,
    uncertainCount: 0,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      events.length > 0
        ? "parsed Climate Pledge Arena music events from Ticketmaster public JSON-LD"
        : "Ticketmaster venue page fetched, but no current Climate Pledge Arena MusicEvent entries were recognized"
  };
}
