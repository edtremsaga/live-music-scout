import type { ClassifiedEvent, EventClassification, LiveMusicEvent } from "./types.js";

const STRONG_MUSIC_TERMS = [
  "band",
  "trio",
  "quartet",
  "quintet",
  "ensemble",
  "orchestra",
  "album release",
  "record release",
  "jazz",
  "singer-songwriter",
  "americana",
  "folk",
  "rock",
  "indie",
  "soul",
  "funk",
  "blues",
  "acoustic",
  "tribute",
  "jam",
  "bluegrass",
  "concert"
];

const CAUTION_TERMS = [
  "comedy",
  "podcast",
  "lecture",
  "talk",
  "conversation",
  "author",
  "screening",
  "film",
  "drag brunch",
  "burlesque",
  "trivia",
  "dance party",
  "dj",
  "broadway",
  "ballet",
  "theater",
  "speaker",
  "magic show",
  "social club",
  "novel",
  "book club",
  "workshop",
  "class",
  "family",
  "kids"
];

const MEDIUM_MUSIC_TERMS = [
  "live music",
  "presents:",
  "w/",
  "feat.",
  "with ",
  "tour",
  "strings",
  "piano",
  "guitar",
  "duo"
];

function toBlob(event: LiveMusicEvent): string {
  return [
    event.title,
    event.artist,
    event.venue,
    event.location,
    event.description,
    event.genreHints.join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countMatches(blob: string, terms: string[]): string[] {
  return terms.filter((term) => blob.includes(term));
}

function looksLikeSoloPerson(title: string): boolean {
  const cleaned = title.replace(/[^\p{L}\p{N}&' .-]/gu, " ").trim();
  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(cleaned);
}

function looksLikeNamedAct(title: string): boolean {
  return /\bw\/\b/i.test(title)
    || /\bfeat\./i.test(title)
    || /\bwith\b/i.test(title)
    || /\b(trio|quartet|quintet|ensemble|orchestra|band|duo)\b/i.test(title)
    || /album release/i.test(title);
}

function classifyEventType(blob: string): EventClassification["eventType"] {
  if (blob.includes("comedy")) {
    return "comedy";
  }

  if (blob.includes("podcast") || blob.includes("lecture") || blob.includes("talk") || blob.includes("conversation")) {
    return "talk";
  }

  if (blob.includes("social club") || blob.includes("novel") || blob.includes("book club") || blob.includes("author")) {
    return "talk";
  }

  if (
    blob.includes("broadway")
    || blob.includes("ballet")
    || blob.includes("theater")
    || blob.includes("screening")
    || blob.includes("film")
  ) {
    return "theater";
  }

  if (blob.includes("dance party") || blob.includes("burlesque") || blob.includes("drag brunch")) {
    return "dance";
  }

  return "unknown";
}

export function classifyEvent(event: LiveMusicEvent): ClassifiedEvent {
  const blob = toBlob(event);
  const title = event.artist ?? event.title;
  const strongMusicMatches = countMatches(blob, STRONG_MUSIC_TERMS);
  const mediumMusicMatches = countMatches(blob, MEDIUM_MUSIC_TERMS);
  const cautionMatches = countMatches(blob, CAUTION_TERMS);
  const eventType = classifyEventType(blob);

  let musicScore = 0;
  const reasons: string[] = [];
  let exclusionReason: string | undefined;

  musicScore += strongMusicMatches.length * 3;
  if (strongMusicMatches.length > 0) {
    reasons.push(`strong music signals: ${strongMusicMatches.slice(0, 2).join(", ")}`);
  }

  musicScore += mediumMusicMatches.length * 2;
  if (mediumMusicMatches.length > 0) {
    reasons.push(`music-like listing language: ${mediumMusicMatches.slice(0, 2).join(", ")}`);
  }

  if (looksLikeNamedAct(title)) {
    musicScore += 3;
    reasons.push("title pattern looks like a bandleader or support-bill listing");
  }

  if (event.venue === "Tractor Tavern" || event.sourceName === "Tractor Tavern") {
    musicScore += 4;
    reasons.push("Tractor Tavern is a strong live-music source");
  }

  if (event.venue === "The Royal Room" || event.sourceName === "The Royal Room") {
    musicScore += 3;
    reasons.push("The Royal Room is strongly music-oriented");
  }

  if (event.venue === "Dimitriou's Jazz Alley" || event.sourceName === "Dimitriou's Jazz Alley") {
    musicScore += 4;
    reasons.push("Jazz Alley is a strong live-music source");
  }

  if (event.sourceName === "STG Presents") {
    musicScore += 1;
    reasons.push("STG can include music, but it needs stronger title signals");
  }

  if (looksLikeSoloPerson(title) && strongMusicMatches.length === 0 && mediumMusicMatches.length === 0) {
    musicScore -= 2;
    reasons.push("single-person title without music wording is ambiguous");
  }

  if (cautionMatches.length > 0) {
    musicScore -= cautionMatches.length * 4;
    exclusionReason = `non-music signals: ${cautionMatches.slice(0, 2).join(", ")}`;
  }

  let isLikelyMusic = false;
  let musicConfidence: EventClassification["musicConfidence"] = "Low";

  if (eventType !== "unknown") {
    isLikelyMusic = false;
    musicConfidence = cautionMatches.length > 0 ? "High" : "Medium";
  } else if (musicScore >= 7) {
    isLikelyMusic = true;
    musicConfidence = "High";
  } else if (musicScore >= 4) {
    isLikelyMusic = true;
    musicConfidence = "Medium";
  } else {
    isLikelyMusic = false;
    musicConfidence = "Low";
  }

  const fitReason = exclusionReason
    ? `${reasons[0] ?? "limited evidence"}; ${exclusionReason}`
    : reasons[0] ?? "limited genre evidence from source text";

  return {
    ...event,
    classification: {
      isLikelyMusic,
      musicConfidence,
      eventType: isLikelyMusic ? "music" : eventType,
      fitReason,
      exclusionReason
    }
  };
}

export function classifyEvents(events: LiveMusicEvent[]): ClassifiedEvent[] {
  return events.map(classifyEvent);
}
