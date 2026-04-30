import { createHash } from "node:crypto";

import { cleanDisplayText, getDateKeyWithOffset, getTonightKey, normalizeWhitespace, stripHtml } from "../dateUtils.js";
import type { LiveMusicEvent, ParserContext, ParserResult } from "../types.js";

const CONOR_BYRNE_LOCATION = "5140 Ballard Ave NW, Seattle, WA 98107";
const DEFAULT_EVENT_LIMIT = 100;

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

export function extractConorByrneVenuePilotConfig(html: string): VenuePilotConfig | undefined {
  const settingsMatch = html.match(/window\.venuepilotSettings\s*=\s*\{[\s\S]*?general\s*:\s*\{([\s\S]*?)\n\s*\}/i);

  if (!settingsMatch) {
    return undefined;
  }

  const generalBlock = settingsMatch[1];
  const accountIdsMatch = generalBlock.match(/accountIds\s*:\s*\[([^\]]+)\]/i);
  const serverMatch = generalBlock.match(/server\s*:\s*['"]([^'"]+)['"]/i);

  if (!accountIdsMatch || !serverMatch) {
    return undefined;
  }

  const accountIds = accountIdsMatch[1]
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
  const server = serverMatch[1].trim();

  if (accountIds.length === 0 || !server.startsWith("https://")) {
    return undefined;
  }

  return {
    accountIds,
    server: server.endsWith("/") ? server : `${server}/`
  };
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
  const hints = new Set<string>(["live music", "concert", "Ballard club", "Conor Byrne Pub"]);
  const blob = `${event.name ?? ""} ${event.support ?? ""} ${event.description ?? ""}`.toLowerCase();
  const keywordPairs: Array<[string, string]> = [
    ["americana", "americana"],
    ["bluegrass", "bluegrass"],
    ["country", "country"],
    ["folk", "folk"],
    ["honky tonk", "honky tonk"],
    ["irish", "irish music"],
    ["jazz", "jazz"],
    ["open mic", "open mic"],
    ["rock", "rock"],
    ["song share", "songwriter"],
    ["songwriter", "songwriter"],
    ["strings", "strings"]
  ];

  for (const [needle, hint] of keywordPairs) {
    if (blob.includes(needle)) {
      hints.add(hint);
    }
  }

  return [...hints];
}

export function isClearlySkippedConorByrneEvent(event: VenuePilotEvent): boolean {
  const blob = `${event.name ?? ""} ${event.support ?? ""} ${event.description ?? ""}`.toLowerCase();
  const nonMusicSignals = [
    "free lindy hop lessons",
    "lindy hop lessons",
    "dance lessons",
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

export function normalizeConorByrneVenuePilotEvent(event: VenuePilotEvent, context: ParserContext): LiveMusicEvent | undefined {
  const title = cleanDisplayText(event.name);
  const date = cleanDisplayText(event.date);
  const url = cleanDisplayText(event.ticketsUrl ?? context.source.url);

  if (!title || !date || !url) {
    return undefined;
  }

  const description = stripVenuePilotDescription(event.description);
  const dedupeKey = `${event.id ?? title}|${date}|${event.startTime ?? event.doorTime ?? ""}|${url}`;

  return {
    id: makeId(dedupeKey),
    title,
    artist: title,
    venue: "Conor Byrne Pub",
    date,
    time: formatVenuePilotTime(event.startTime ?? event.doorTime),
    location: CONOR_BYRNE_LOCATION,
    url,
    sourceName: context.source.name,
    genreHints: collectGenreHints(event),
    description,
    confidence: "High",
    basis: normalizeWhitespace([
      "Parsed from Conor Byrne Pub's public VenuePilot event widget",
      event.status ? `VenuePilot status ${event.status}` : "VenuePilot status unavailable",
      event.minimumAge ? `${event.minimumAge}+ listing` : undefined,
      "venue fit suggests intimate Ballard folk, roots, songwriter, country, bluegrass, jazz, and local-band bookings"
    ].filter(Boolean).join("; "))
  };
}

export async function parseConorByrne(html: string, context: ParserContext): Promise<ParserResult> {
  const config = extractConorByrneVenuePilotConfig(html);

  if (!config) {
    return {
      events: [],
      candidateCount: 0,
      parserConfidence: "Low",
      statusMessage: "parser TODO: Conor Byrne Pub page fetched, but no reliable public VenuePilot widget configuration was found"
    };
  }

  const venuePilotEvents = await fetchVenuePilotEvents(config, context);
  const events: LiveMusicEvent[] = [];
  const seenIds = new Set<string>();

  for (const venuePilotEvent of venuePilotEvents) {
    if (isClearlySkippedConorByrneEvent(venuePilotEvent)) {
      continue;
    }

    const event = normalizeConorByrneVenuePilotEvent(venuePilotEvent, context);

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
        ? "parsed Conor Byrne Pub events from the public VenuePilot widget"
        : "VenuePilot widget was found, but no Conor Byrne Pub events were returned"
  };
}
