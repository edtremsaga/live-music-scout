import type { ClassifiedEvent, Preferences, RankedEvent } from "./types.js";

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

  if (blob.includes("sunset tavern")) {
    score += 3;
    matchReasons.push("Sunset Tavern often lines up with indie rock, rock, and local band bills");
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
      if (event.classification.isLikelyMusic && event.classification.musicConfidence !== "Low" && score >= 6) {
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
