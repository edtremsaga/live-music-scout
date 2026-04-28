import type { LiveMusicEvent } from "./types.js";

type EventStatusLike = Pick<LiveMusicEvent, "title" | "artist" | "description">;

const TITLE_STATUS_PATTERNS = [
  /\bpostponed\b/i,
  /\bcancelled\b/i,
  /\bcanceled\b/i,
  /\brescheduled\b/i,
  /\bnew date (?:tba|tbd)\b/i,
  /\bdate changed\b/i,
  /\bmoved date\b/i,
  /\bmoved to\b/i
];

const DESCRIPTION_STATUS_PATTERNS = [
  /\b(?:this|the)\s+(?:show|event)\s+(?:has been|is)\s+(?:postponed|cancelled|canceled|rescheduled)\b/i,
  /\bnew date (?:tba|tbd)\b/i,
  /\bdate changed\b/i,
  /\bmoved to\b/i,
  /\bpostponed until\b/i
];

export function hasEventStatusIssue(event: EventStatusLike): boolean {
  return getEventStatusIssueReason(event) !== undefined;
}

export function getEventStatusIssueReason(event: EventStatusLike): string | undefined {
  const titleBlob = [event.artist, event.title].filter(Boolean).join(" ");
  const description = event.description ?? "";

  if (TITLE_STATUS_PATTERNS.some((pattern) => pattern.test(titleBlob))) {
    return "postponed/rescheduled — check the source for current status";
  }

  if (DESCRIPTION_STATUS_PATTERNS.some((pattern) => pattern.test(description))) {
    return "postponed/rescheduled — check the source for current status";
  }

  return undefined;
}
