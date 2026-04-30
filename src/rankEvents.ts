import type { ClassifiedEvent, Preferences, RankedEvent } from "./types.js";
import { hasEventStatusIssue } from "./eventStatus.js";

function toSearchBlob(event: ClassifiedEvent): string {
  return [
    event.title,
    event.artist,
    event.venue,
    event.location,
    event.description,
    event.genreHints.join(" "),
    event.classification.fitReason
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function containsAny(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term.toLowerCase()));
}

function addVenueAwareScoring(blob: string, matchReasons: string[]): number {
  let score = 0;

  if (blob.includes("tractor tavern")) {
    score += 4;
    matchReasons.push("Tractor Tavern tends to book roots, Americana, rock, and songwriter-friendly shows");
  }

  if (blob.includes("the royal room")) {
    score += 4;
    matchReasons.push("The Royal Room usually fits jazz, soul, funk, local musicianship, and a more comfortable room");
  }

  if (blob.includes("dimitriou's jazz alley") || blob.includes("jazz alley")) {
    score += 4;
    matchReasons.push("Jazz Alley is usually a strong fit for seated jazz, soul, and high-level musicianship");
  }

  if (blob.includes("sunset tavern")) {
    score += 3;
    matchReasons.push("Sunset Tavern often lines up with indie rock, rock, and local band bills");
  }

  if (blob.includes("neumos")) {
    score += 2;
    matchReasons.push("Neumos often surfaces Capitol Hill touring and local club shows");
  }

  if (blob.includes("barboza")) {
    score += 2;
    matchReasons.push("Barboza often surfaces intimate Capitol Hill touring and local club shows");
  }

  if (blob.includes("chop suey")) {
    score += 2;
    matchReasons.push("Chop Suey often surfaces Capitol Hill touring, local, and genre-club shows");
  }

  if (
    blob.includes("the paramount theatre")
    || blob.includes("the moore theatre")
    || blob.includes("the neptune theatre")
    || blob.includes("stg presents")
  ) {
    score += 1;
    matchReasons.push("STG can surface notable touring acts, even if the room is bigger than your ideal");
  }

  return score;
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

const RELEASE_SHOW_TERMS = ["album release", "record release", "release show"];
const BENEFIT_OR_FUNDRAISER_TERMS = ["benefit concert", "fundraiser", "benefit for"];
const ARTIST_DETAIL_TERMS = [
  " w/ ",
  " feat.",
  " with ",
  "trio",
  "quartet",
  "quintet",
  "sextet",
  "septet",
  "ensemble",
  "orchestra",
  "band",
  "songteller",
  "plays the music"
];

export function rankEvents(
  events: ClassifiedEvent[],
  preferences: Preferences,
  seenEventIds: Set<string>
): RankedEvent[] {
  return events
    .map((event) => {
      const blob = toSearchBlob(event);
      const matches = containsAny(blob, preferences.preferredGenres);
      const avoids = containsAny(blob, preferences.avoidGenres);
      const venueMatches = containsAny(blob, preferences.venuePreferences);
      const frictionMatches = containsAny(blob, preferences.avoidSignals);
      const isSeen = seenEventIds.has(event.id);

      let score = 0;
      const matchReasons: string[] = [];

      score += addVenueAwareScoring(blob, matchReasons);

      if (event.classification.isLikelyMusic) {
        score += event.classification.musicConfidence === "High" ? 4 : 2;
        matchReasons.push(event.classification.fitReason);
      } else {
        score -= event.classification.musicConfidence === "High" ? 8 : 5;
        matchReasons.push(event.classification.exclusionReason ?? "music evidence is too weak to recommend confidently");
      }

      for (const match of matches) {
        score += 3;
        matchReasons.push(`signals ${match}`);
      }

      for (const match of venueMatches) {
        score += 2;
        matchReasons.push(`venue vibe suggests ${match}`);
      }

      for (const match of avoids) {
        score -= 4;
        matchReasons.push(`contains lower-priority signal: ${match}`);
      }

      for (const match of frictionMatches) {
        score -= 1;
        matchReasons.push(`possible friction: ${match}`);
      }

      if (blob.includes("tribute")) {
        score += 2;
        matchReasons.push("tribute/show concept could fit classic rock preference");
      }

      if (blob.includes("jam")) {
        score += 3;
        matchReasons.push("jam-oriented language is a strong fit");
      }

      if (blob.includes("jazz")) {
        score += 2;
        matchReasons.push("jazz signal matches stated taste");
      }

      if (blob.includes("funk") || blob.includes("soul")) {
        score += 2;
        matchReasons.push("funk or soul language fits well");
      }

      if (hasAny(blob, RELEASE_SHOW_TERMS)) {
        score += 3;
        matchReasons.push("release-show language makes this feel more music-forward");
      }

      if (hasAny(blob, BENEFIT_OR_FUNDRAISER_TERMS) && !hasAny(blob, ARTIST_DETAIL_TERMS)) {
        score -= 3;
        matchReasons.push("benefit/fundraiser wording is plausible music but light on artist detail");
      }

      if (
        blob.includes("comedy")
        || blob.includes("podcast")
        || blob.includes("ballet")
        || blob.includes("speaker")
        || blob.includes("broadway")
        || blob.includes("social club")
        || blob.includes("novel")
        || blob.includes("book club")
      ) {
        score -= 6;
        matchReasons.push("listing looks more like a non-music event than a live-music fit");
      }

      if (blob.includes("dj")) {
        score -= 4;
        matchReasons.push("DJ-focused signal lowers the fit");
      }

      if (
        blob.includes("the royal room")
        && hasAny(blob, ["happy hour", "birthday bash", "workshop", "showcase", "launch", "circle", "sessions"])
        && !hasAny(blob, ["album release", "trio", "quartet", "quintet", "ensemble", "orchestra", "concert", "jazz", "jam", "w/", "feat.", "with "])
      ) {
        score -= 4;
        matchReasons.push("Royal Room listing is too sparse or generic to treat as a top pick");
      }

      if (
        blob.includes(" trio ")
        || blob.startsWith("trio ")
        || blob.includes(" quartet ")
        || blob.includes(" quintet ")
        || blob.includes(" ensemble ")
        || blob.includes(" big band ")
        || blob.includes(" orchestra ")
        || blob.includes(" singer-songwriter ")
      ) {
        score += 2;
        matchReasons.push("artist naming suggests a real bandleader or ensemble performance");
      }

      if (event.confidence === "High") {
        score += 1;
      }

      if (event.confidence === "Low") {
        score -= 1;
      }

      if (isSeen) {
        score -= 2;
        matchReasons.push("already seen before, so deprioritized");
      }

      let verdict: RankedEvent["verdict"] = "Skip";
      if (hasEventStatusIssue(event)) {
        score -= 8;
        matchReasons.push("event status appears postponed, canceled, or rescheduled");
        verdict = "Skip";
      } else if (event.classification.isLikelyMusic && event.classification.musicConfidence !== "Low" && score >= 6) {
        verdict = "Go";
      } else if (
        (event.classification.isLikelyMusic && score >= 2)
        || (!event.classification.isLikelyMusic && event.classification.eventType === "unknown" && score >= 2)
      ) {
        verdict = "Maybe";
      }

      if (matchReasons.length === 0) {
        matchReasons.push("limited genre evidence from source text");
      }

      return {
        ...event,
        score,
        verdict,
        matchReasons,
        isSeen
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
