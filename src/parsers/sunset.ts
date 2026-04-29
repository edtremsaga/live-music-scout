import { createHash } from "node:crypto";

import { cleanDisplayText, normalizeWhitespace } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const DICE_EVENTS_ENDPOINT = "https://partners-endpoint.dice.fm/api/v2/events";
const DEFAULT_SUNSET_LOCATION = "5433 Ballard Avenue Northwest, Seattle, WA 98107";
const MAX_DICE_EVENTS = 100;

type DiceWidgetConfig = {
  apiKey: string;
  promoters: string[];
};

type DiceLineupItem = {
  details?: string;
  time?: string;
};

type DiceEvent = {
  id?: string;
  name?: string;
  date?: string;
  timezone?: string;
  venue?: string;
  address?: string;
  url?: string;
  external_url?: string | null;
  description?: string;
  raw_description?: string;
  artists?: string[];
  genre_tags?: string[];
  type_tags?: string[];
  tags?: string[];
  flags?: string[];
  status?: string;
  lineup?: DiceLineupItem[];
};

type DiceEventsResponse = {
  data?: DiceEvent[];
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function toPacificDateKey(value: string, timezone: string): string | undefined {
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

  if (!parts.year || !parts.month || !parts.day) {
    return undefined;
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toPacificTime(value: string, timezone: string): string | undefined {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function stripMarkdown(value: string | undefined): string | undefined {
  const cleaned = cleanDisplayText(value)
    .replace(/\*\*/g, "")
    .replace(/\[(.*?)\]\([^)]*\)/g, "$1")
    .replace(/#{1,6}\s*/g, "");

  return cleaned || undefined;
}

function extractDiceWidgetConfig(html: string): DiceWidgetConfig | undefined {
  const match = html.match(/DiceEventListWidget\.create\((\{[\s\S]*?\})\);/i);

  if (!match) {
    return undefined;
  }

  try {
    const config = JSON.parse(match[1]) as Partial<DiceWidgetConfig>;

    if (
      typeof config.apiKey !== "string"
      || !config.apiKey
      || !Array.isArray(config.promoters)
      || config.promoters.some((promoter) => typeof promoter !== "string")
    ) {
      return undefined;
    }

    return {
      apiKey: config.apiKey,
      promoters: config.promoters
    };
  } catch {
    return undefined;
  }
}

function buildDiceEventsUrl(config: DiceWidgetConfig): string {
  const url = new URL(DICE_EVENTS_ENDPOINT);
  url.searchParams.set("page[size]", String(MAX_DICE_EVENTS));
  url.searchParams.set("types", "linkout,event");

  for (const promoter of config.promoters) {
    url.searchParams.append("filter[promoters][]", promoter);
  }

  url.searchParams.append("filter[flags][]", "going_ahead");
  url.searchParams.append("filter[flags][]", "rescheduled");

  return url.toString();
}

async function fetchDiceEvents(config: DiceWidgetConfig): Promise<DiceEvent[]> {
  const response = await fetch(buildDiceEventsUrl(config), {
    headers: {
      accept: "application/json",
      "user-agent": "LiveMusicScout/0.1 (+local CLI prototype)",
      "x-api-key": config.apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`DICE event request failed: HTTP ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as DiceEventsResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

function collectGenreHints(event: DiceEvent): string[] {
  const hints = new Set<string>(["live bands", "Ballard club"]);
  const rawHints = [
    ...(event.genre_tags ?? []),
    ...(event.type_tags ?? []),
    ...(event.tags ?? [])
  ];

  for (const hint of rawHints) {
    const cleaned = cleanDisplayText(hint.replace(/^(gig|genre|music):/i, ""));

    if (cleaned) {
      hints.add(cleaned);
    }
  }

  return [...hints];
}

function getEventTime(event: DiceEvent, timezone: string): string | undefined {
  const firstPerformanceTime = event.lineup?.find((item) => {
    const details = item.details?.toLowerCase() ?? "";
    return item.time && !details.includes("doors open");
  })?.time;

  return firstPerformanceTime || (event.date ? toPacificTime(event.date, timezone) : undefined);
}

function normalizeDiceEvent(event: DiceEvent, context: ParserContext): LiveMusicEvent | undefined {
  const title = cleanDisplayText(event.name);
  const dateKey = event.date ? toPacificDateKey(event.date, event.timezone ?? context.timezone) : undefined;
  const url = event.url ?? event.external_url ?? context.source.url;

  if (!title || !dateKey || !url) {
    return undefined;
  }

  const description = stripMarkdown(event.raw_description ?? event.description);
  const artists = event.artists?.map(cleanDisplayText).filter(Boolean) ?? [];
  const dedupeKey = `${event.id ?? title}|${dateKey}|${url}`;

  return {
    id: makeId(dedupeKey),
    title,
    artist: artists.length > 0 ? artists.join(", ") : title,
    venue: context.source.name,
    date: dateKey,
    time: getEventTime(event, event.timezone ?? context.timezone),
    location: cleanDisplayText(event.address) || DEFAULT_SUNSET_LOCATION,
    url,
    sourceName: context.source.name,
    genreHints: collectGenreHints(event),
    description,
    confidence: "High",
    basis: normalizeWhitespace([
      "Parsed from Sunset Tavern's embedded DICE event widget",
      event.status ? `DICE status ${event.status}` : "DICE status unavailable",
      "venue fit suggests Ballard club shows, touring bands, local bands, indie, folk, rock, and roots-adjacent bookings"
    ].join("; "))
  };
}

export async function parseSunset(html: string, context: ParserContext): Promise<ParserResult> {
  const config = extractDiceWidgetConfig(html);

  if (!config) {
    return {
      events: [],
      candidateCount: 0,
      parserConfidence: "Low",
      statusMessage: "parser TODO: Sunset Tavern fetched successfully, but no reliable DICE widget configuration was found"
    };
  }

  const diceEvents = await fetchDiceEvents(config);
  const events: LiveMusicEvent[] = [];
  const seenIds = new Set<string>();

  for (const diceEvent of diceEvents) {
    const event = normalizeDiceEvent(diceEvent, context);

    if (!event || seenIds.has(event.id)) {
      continue;
    }

    events.push(event);
    seenIds.add(event.id);
  }

  return {
    events,
    candidateCount: diceEvents.length,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      events.length > 0
        ? "parsed Sunset Tavern events from the embedded DICE event widget"
        : "DICE widget was found, but no Sunset Tavern events were returned"
  };
}

export const sunsetParserTestExports = {
  buildDiceEventsUrl,
  extractDiceWidgetConfig,
  normalizeDiceEvent
};
