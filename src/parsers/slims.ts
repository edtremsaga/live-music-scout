import { createHash } from "node:crypto";

import { cleanDisplayText, getDateKeyWithOffset, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const SLIMS_LOCATION = "5606 1st Ave S, Seattle, WA 98108";
const DEFAULT_EVENT_LIMIT = 100;

type VenuePilotSettings = {
  general?: {
    accountIds?: unknown;
    server?: unknown;
  };
};

type VenuePilotConfig = {
  accountIds: number[];
  server: string;
};

type VenuePilotEvent = {
  id?: number;
  name?: string;
  date?: string;
  doorTime?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  minimumAge?: number | null;
  promoter?: string | null;
  support?: string | null;
  description?: string | null;
  status?: string | null;
  venue?: {
    name?: string | null;
  } | null;
  ticketsUrl?: string | null;
};

type VenuePilotEventsResponse = {
  data?: {
    publicEvents?: VenuePilotEvent[];
  };
  errors?: Array<{ message?: string }>;
};

function makeId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 16);
}

function getFetchHeaders(): HeadersInit {
  return {
    accept: "text/html,application/xhtml+xml,application/json,text/javascript,*/*",
    "user-agent": "LiveMusicScout/0.1 (+local CLI prototype)"
  };
}

async function fetchPublicText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: getFetchHeaders()
  });

  if (!response.ok) {
    throw new Error(`public Slim's source fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function extractSlimsSiteAssetUrls(html: string): string[] {
  const urls = Array.from(html.matchAll(/https:\/\/siteassets\.parastorage\.com\/pages\/pages\/thunderbolt\?[^"'<> ]+/g))
    .map((match) => match[0].replace(/&amp;/g, "&"));

  return [...new Set(urls)];
}

function collectStrings(value: unknown, matches: string[]): void {
  if (typeof value === "string") {
    matches.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, matches);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, matches);
    }
  }
}

export function extractSlimsTicketingEmbedUrls(pageAssetJson: string): string[] {
  try {
    const parsed = JSON.parse(pageAssetJson) as unknown;
    const strings: string[] = [];
    collectStrings(parsed, strings);

    return [...new Set(strings.filter((value) => (
      value.includes("slimslastchance")
      && value.includes("filesusr.com/html/")
      && value.endsWith(".html")
    )))];
  } catch {
    return [];
  }
}

export function extractVenuePilotWidgetUrl(embedHtml: string): string | undefined {
  const match = embedHtml.match(/<script[^>]+src=["'](https:\/\/www\.venuepilot\.co\/widgets\/[^"']+\.js)["']/i);
  return match?.[1];
}

export function extractVenuePilotConfig(widgetJs: string): VenuePilotConfig | undefined {
  const match = widgetJs.match(/window\.venuepilotSettings\s*=\s*(\{[\s\S]*?\})\s*;\s*let\s+styleEl/i);

  if (!match) {
    return undefined;
  }

  try {
    const settings = JSON.parse(match[1]) as VenuePilotSettings;
    const accountIds = settings.general?.accountIds;
    const server = settings.general?.server;

    if (
      !Array.isArray(accountIds)
      || accountIds.some((accountId) => !Number.isInteger(accountId))
      || typeof server !== "string"
      || !server.startsWith("https://")
    ) {
      return undefined;
    }

    return {
      accountIds,
      server: server.endsWith("/") ? server : `${server}/`
    };
  } catch {
    return undefined;
  }
}

async function resolveVenuePilotConfig(html: string): Promise<VenuePilotConfig | undefined> {
  for (const siteAssetUrl of extractSlimsSiteAssetUrls(html)) {
    const pageAssetJson = await fetchPublicText(siteAssetUrl);

    for (const embedUrl of extractSlimsTicketingEmbedUrls(pageAssetJson)) {
      const embedHtml = await fetchPublicText(embedUrl);
      const widgetUrl = extractVenuePilotWidgetUrl(embedHtml);

      if (!widgetUrl) {
        continue;
      }

      const widgetJs = await fetchPublicText(widgetUrl);
      const config = extractVenuePilotConfig(widgetJs);

      if (config) {
        return config;
      }
    }
  }

  return undefined;
}

function formatVenuePilotTime(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return undefined;
  }

  const hour24 = Number(match[1]);
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${match[2]} ${suffix}`;
}

function stripVenuePilotDescription(value: string | null | undefined): string | undefined {
  const cleaned = cleanDisplayText(stripHtml(value ?? ""))
    .replace(/\s+/g, " ");

  return cleaned || undefined;
}

function collectGenreHints(event: VenuePilotEvent): string[] {
  const hints = new Set<string>(["live music", "concert", "live bands", "Georgetown club", "Slim's Last Chance"]);
  const blob = `${event.name ?? ""} ${event.support ?? ""} ${event.description ?? ""}`.toLowerCase();
  const keywordPairs: Array<[string, string]> = [
    ["rock", "rock"],
    ["punk", "punk"],
    ["metal", "metal"],
    ["americana", "americana"],
    ["country", "country"],
    ["blues", "blues"],
    ["roots", "roots"],
    ["garage", "garage rock"],
    ["open mic", "open mic"],
    ["karaoke", "live band karaoke"],
    ["band", "live bands"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

export function isClearlySkippedSlimsEvent(event: VenuePilotEvent): boolean {
  const blob = `${event.name ?? ""} ${event.support ?? ""} ${event.description ?? ""}`.toLowerCase();
  const nonMusicSignals = [
    "vintage motorcycle enthusiasts",
    "motorcycle enthusiasts meetup",
    "private event",
    "closed for",
    "trivia",
    "watch party",
    "workshop",
    "class"
  ];

  return nonMusicSignals.some((signal) => blob.includes(signal));
}

function buildVenuePilotEventsQuery(): string {
  return `
    query ($accountIds: [Int!]!, $startDate: String!, $endDate: String, $limit: Int) {
      publicEvents(accountIds: $accountIds, startDate: $startDate, endDate: $endDate, limit: $limit) {
        id
        name
        date
        doorTime
        startTime
        endTime
        minimumAge
        promoter
        support
        description
        status
        venue {
          name
        }
        ticketsUrl
      }
    }
  `;
}

async function fetchVenuePilotEvents(config: VenuePilotConfig, context: ParserContext): Promise<VenuePilotEvent[]> {
  const response = await fetch(new URL("/graphql", config.server).toString(), {
    method: "POST",
    headers: {
      ...getFetchHeaders(),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: buildVenuePilotEventsQuery(),
      variables: {
        accountIds: config.accountIds,
        startDate: getTonightKey(context.now, context.timezone),
        endDate: getDateKeyWithOffset(context.now, 370, context.timezone),
        limit: DEFAULT_EVENT_LIMIT
      }
    })
  });

  if (!response.ok) {
    throw new Error(`VenuePilot public event request failed: HTTP ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as VenuePilotEventsResponse;

  if (payload.errors?.length) {
    throw new Error(`VenuePilot public event request failed: ${payload.errors.map((error) => error.message).filter(Boolean).join("; ")}`);
  }

  return Array.isArray(payload.data?.publicEvents) ? payload.data.publicEvents : [];
}

export function normalizeSlimsVenuePilotEvent(event: VenuePilotEvent, context: ParserContext): LiveMusicEvent | undefined {
  const title = cleanDisplayText(event.name);
  const date = cleanDisplayText(event.date);
  const url = cleanDisplayText(event.ticketsUrl ?? context.source.url);
  const venue = cleanDisplayText(event.venue?.name ?? context.source.name) || context.source.name;

  if (!title || !date || !url) {
    return undefined;
  }

  const description = stripVenuePilotDescription(event.description);
  const dedupeKey = `${event.id ?? title}|${date}|${event.startTime ?? event.doorTime ?? ""}|${url}`;

  return {
    id: makeId(dedupeKey),
    title,
    artist: title,
    venue,
    date,
    time: formatVenuePilotTime(event.startTime ?? event.doorTime),
    location: SLIMS_LOCATION,
    url,
    sourceName: context.source.name,
    genreHints: collectGenreHints(event),
    description,
    confidence: "High",
    basis: normalizeWhitespace([
      "Parsed from Slim's Last Chance public VenuePilot event widget",
      event.status ? `VenuePilot status ${event.status}` : "VenuePilot status unavailable",
      event.minimumAge ? `${event.minimumAge}+ listing` : undefined,
      "venue fit suggests Georgetown club shows, local bands, roots, rock, punk, metal, Americana, and bar-stage bookings"
    ].filter(Boolean).join("; "))
  };
}

export async function parseSlims(html: string, context: ParserContext): Promise<ParserResult> {
  const config = await resolveVenuePilotConfig(html);

  if (!config) {
    return {
      events: [],
      candidateCount: 0,
      parserConfidence: "Low",
      statusMessage: "parser TODO: Slim's Last Chance page fetched, but no reliable public VenuePilot widget configuration was found"
    };
  }

  const venuePilotEvents = await fetchVenuePilotEvents(config, context);
  const events: LiveMusicEvent[] = [];
  const seenIds = new Set<string>();

  for (const venuePilotEvent of venuePilotEvents) {
    if (isClearlySkippedSlimsEvent(venuePilotEvent)) {
      continue;
    }

    const event = normalizeSlimsVenuePilotEvent(venuePilotEvent, context);

    if (!event || seenIds.has(event.id)) {
      continue;
    }

    events.push(event);
    seenIds.add(event.id);
  }

  return {
    events,
    candidateCount: venuePilotEvents.length,
    parserConfidence: events.length > 0 ? "High" : "Low",
    statusMessage:
      events.length > 0
        ? "parsed Slim's Last Chance events from the public VenuePilot widget"
        : "VenuePilot widget was found, but no Slim's Last Chance events were returned"
  };
}
