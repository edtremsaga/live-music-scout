import { cleanDisplayText, formatDateKeyShort, formatDateKeyWeekday, formatDateRangeLong, formatTonightLong, getTimeOfDayNote } from "./dateUtils.js";
import { getEventStatusIssueReason, hasEventStatusIssue } from "./eventStatus.js";
import type { RankedEvent } from "./types.js";

export type WeeklyHighlightGroup = {
  key: string;
  representative: RankedEvent;
  events: RankedEvent[];
};

type WeeklyEmailOptions = {
  includeEvaluatedShows?: boolean;
};

const MAX_WEEKLY_HIGHLIGHTS = 6;
const MAX_WEEKLY_ALSO_WORTH = 6;
const MAX_DAILY_HIGHLIGHTS_PER_VENUE = 2;
const MAX_DAILY_HIGHLIGHTS_PER_SOURCE = 2;
const MAX_DAILY_ALSO_WORTH_PER_VENUE = 2;
const MAX_DAILY_ALSO_WORTH_PER_SOURCE = 2;
const MAX_WEEKLY_ALSO_WORTH_PER_VENUE = 2;
const MAX_WEEKLY_ALSO_WORTH_PER_SOURCE = 2;
const MAX_WEEKLY_HIGHLIGHTS_PER_VENUE = 2;
const MAX_WEEKLY_HIGHLIGHTS_PER_SOURCE = 2;
const MAX_WEEKLY_TOP_SECTIONS_PER_VENUE = 3;
const MAX_WEEKLY_TOP_SECTIONS_PER_SOURCE = 3;
const MAX_WEEKLY_HIGHLIGHTS_LARGE_SCALE = 2;
const MAX_WEEKLY_TOP_SECTIONS_LARGE_SCALE = 3;
const WEEKLY_DIVERSITY_OVERRIDE_GAP = 1;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publicText(value: string | undefined): string {
  return cleanDisplayText(value);
}

function getEventTextBlob(event: Pick<RankedEvent, "title" | "artist" | "venue" | "description" | "genreHints" | "sourceName">): string {
  return [
    publicText(event.title),
    publicText(event.artist),
    publicText(event.venue),
    publicText(event.description),
    event.genreHints.join(" "),
    publicText(event.sourceName)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isRecurringJamNight(event: RankedEvent): boolean {
  const blob = getEventTextBlob(event);
  return blob.includes("jam") && (blob.includes("mondays") || blob.includes("weekly") || blob.includes("recurring"));
}

function isLocalBandBill(event: RankedEvent): boolean {
  const blob = getEventTextBlob(event);
  const title = publicText(event.artist ?? event.title);
  return (
    (
      event.sourceName === "Skylark Cafe"
      || event.sourceName === "Hidden Hall"
      || event.sourceName === "Nectar Lounge"
      || event.sourceName === "Neumos"
      || event.sourceName === "Barboza"
      || event.sourceName === "Conor Byrne Pub"
    )
    && (title.includes(",") || /\bw\/\b/i.test(title) || /\bwith\b/i.test(title))
    && !blob.includes("dj ")
  );
}

function isMixedFormatPerformance(event: RankedEvent): boolean {
  const blob = getEventTextBlob(event);
  return blob.includes("dina martina");
}

function isLargeScaleConcertSource(event: Pick<RankedEvent, "sourceName" | "venue">): boolean {
  return [
    "Marymoor Park Concerts",
    "Chateau Ste. Michelle Summer Concerts",
    "Woodland Park Zoo / ZooTunes",
    "Remlinger Farms Summer Concerts",
    "Climate Pledge Arena"
  ].includes(event.sourceName)
    || [
      "Marymoor Park",
      "Chateau Ste. Michelle Amphitheatre",
      "Woodland Park Zoo",
      "Remlinger Farms",
      "Climate Pledge Arena"
    ].includes(event.venue);
}

export function getSourceLinkLabel(event: Pick<RankedEvent, "url" | "sourceName" | "venue">): string {
  const url = event.url.toLowerCase();

  if (event.venue === "Tractor Tavern" || event.sourceName === "Tractor Tavern") {
    return "Tractor/TicketWeb listing";
  }

  if (event.sourceName === "The Crocodile" || event.venue === "The Crocodile" || event.venue === "Madame Lou's" || event.venue === "Here - After" || url.includes("ticketweb.com/events/org/243963")) {
    return "The Crocodile/TicketWeb event page";
  }

  if (url.includes("ticketweb.com")) {
    return "TicketWeb listing";
  }

  if (event.venue === "The Royal Room" || event.sourceName === "The Royal Room" || url.includes("theroyalroomseattle.com")) {
    return "Royal Room event page";
  }

  if (event.venue === "Bake's Place" || event.sourceName === "Bake's Place" || url.includes("bakesplacebellevue.com")) {
    return "Bake's Place event page";
  }

  if (event.venue === "Nectar Lounge" || event.sourceName === "Nectar Lounge" || url.includes("nectarlounge.com")) {
    return "Nectar Lounge event page";
  }

  if (event.venue === "Hidden Hall" || event.sourceName === "Hidden Hall" || url.includes("hiddenhall.com")) {
    return "Hidden Hall event page";
  }

  if (event.venue === "Dimitriou's Jazz Alley" || event.sourceName === "Dimitriou's Jazz Alley" || url.includes("jazzalley.com")) {
    return "Jazz Alley event page";
  }

  if (event.venue === "The Triple Door" || event.sourceName === "The Triple Door" || url.includes("thetripledoor.net")) {
    return "The Triple Door event page";
  }

  if (event.venue === "Skylark Cafe" || event.sourceName === "Skylark Cafe" || url.includes("skylarkcafe.com")) {
    return "Skylark Cafe event page";
  }

  if (event.venue === "Sunset Tavern" || event.sourceName === "Sunset Tavern" || url.includes("dice.fm")) {
    return "Sunset Tavern event page";
  }

  if (event.venue === "Neumos" || event.sourceName === "Neumos" || url.includes("neumos.com")) {
    return "Neumos event page";
  }

  if (event.venue === "Barboza" || event.sourceName === "Barboza" || url.includes("thebarboza.com")) {
    return "Barboza event page";
  }

  if (event.venue === "Chop Suey" || event.sourceName === "Chop Suey" || url.includes("chopsuey.com")) {
    return "Chop Suey event page";
  }

  if (event.venue === "Conor Byrne Pub" || event.sourceName === "Conor Byrne Pub" || url.includes("conorbyrnepub.com")) {
    return "Conor Byrne event page";
  }

  if (event.sourceName === "El Corazon" || url.includes("elcorazonseattle.com")) {
    return "El Corazon/Funhouse event page";
  }

  if (event.venue === "Slim's Last Chance" || event.sourceName === "Slim's Last Chance" || url.includes("venuepilot.com")) {
    return "Slim's Last Chance event page";
  }

  if (event.venue === "SeaMonster Lounge" || event.sourceName === "SeaMonster Lounge" || url.includes("seamonsterlounge.com")) {
    return "SeaMonster Lounge event page";
  }

  if (event.sourceName === "Chateau Ste. Michelle Summer Concerts" || url.includes("ste-michelle.com")) {
    return "Chateau Ste. Michelle event page";
  }

  if (event.sourceName === "Marymoor Park Concerts" || url.includes("marymoorlive.com")) {
    return "Marymoor Live event page";
  }

  if (event.sourceName === "Woodland Park Zoo / ZooTunes" || url.includes("zoo.org/zootunes") || url.includes("etix.com")) {
    return "ZooTunes event page";
  }

  if (event.sourceName === "KEXP Events" || url.includes("kexp.org/events")) {
    return "KEXP event page";
  }

  if (event.sourceName === "Climate Pledge Arena" || event.venue === "Climate Pledge Arena" || url.includes("climate-pledge-arena")) {
    return "Climate Pledge/Ticketmaster event page";
  }

  if (event.sourceName === "STG Presents" || url.includes("stgpresents.org")) {
    return "STG event page";
  }

  return "Event page";
}

function formatSourceLinkMarkdown(event: Pick<RankedEvent, "url" | "sourceName" | "venue">): string {
  return `[${getSourceLinkLabel(event)}](${event.url})`;
}

function formatSourceLinkHtml(event: Pick<RankedEvent, "url" | "sourceName" | "venue">): string {
  return `<a href="${escapeHtml(event.url)}">${escapeHtml(publicText(getSourceLinkLabel(event)))}</a>`;
}

function escapeSlackText(value: string): string {
  return publicText(value)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatSourceLinkSlack(event: Pick<RankedEvent, "url" | "sourceName" | "venue">): string {
  const label = escapeSlackText(getSourceLinkLabel(event)).replace(/\|/g, "-");
  const url = event.url.replace(/>/g, "%3E");
  return `<${url}|${label}>`;
}

function formatVerdict(verdict: RankedEvent["verdict"]): string {
  if (verdict === "Go") {
    return "Go if tickets are available.";
  }

  if (verdict === "Maybe") {
    return "Maybe — check a clip first.";
  }

  return "Skip — probably not the kind of live music night this scout is looking for.";
}

type EventTag =
  | "album_release"
  | "single_release"
  | "ep_release"
  | "tribute"
  | "legacy_act"
  | "touring_act"
  | "local_bill"
  | "multi_band_bill"
  | "seated_show"
  | "dance_night"
  | "dj_night"
  | "early_show"
  | "late_show"
  | "benefit"
  | "open_mic"
  | "jam_night"
  | "mixed_format";

type WhyLineContext = {
  usedStems: Map<string, number>;
};

function createWhyLineContext(): WhyLineContext {
  return { usedStems: new Map() };
}

function hasBillSeparator(title: string): boolean {
  return /,|\/\/|\+|&|\bw\/\b|\bwith\b|\bfeat\.?\b/i.test(title);
}

function getEventHour(event: RankedEvent): number | undefined {
  const match = publicText(event.time).match(/\b(\d{1,2})(?::\d{2})?\s*(AM|PM)\b/i);
  if (!match) {
    return undefined;
  }

  const rawHour = Number(match[1]);
  const period = match[2].toUpperCase();

  if (period === "AM") {
    return rawHour === 12 ? 0 : rawHour;
  }

  return rawHour === 12 ? 12 : rawHour + 12;
}

function inferEventTags(event: RankedEvent): EventTag[] {
  const blob = getEventTextBlob(event);
  const title = publicText(event.artist ?? event.title);
  const titleLower = title.toLowerCase();
  const tags: EventTag[] = [];

  if (/\b(album release|record release|release show)\b/i.test(blob)) tags.push("album_release");
  if (/\bsingle release\b/i.test(blob)) tags.push("single_release");
  if (/\bep release\b/i.test(blob)) tags.push("ep_release");
  if (/\btribute|plays the music of|songs of\b/i.test(blob)) tags.push("tribute");
  if (/\blegacy|all-?stars|sinatra|dylan|chicago legacy\b/i.test(blob)) tags.push("legacy_act");
  if (/\bbenefit|fundraiser\b/i.test(blob)) tags.push("benefit");
  if (/\bopen mic|song share\b/i.test(titleLower)) tags.push("open_mic");
  if (/\bjam night|mo' jam|jam mondays|weinstein wednesday\b/i.test(titleLower)) tags.push("jam_night");
  if (/\bdance night|club night|karaoke|k-?pop|edm|disco\b/i.test(titleLower)) tags.push("dance_night");
  if (/\bdj\b/i.test(titleLower)) tags.push("dj_night");
  if (isMixedFormatPerformance(event) || /\bcomedy|cabaret|dating show\b/i.test(titleLower)) tags.push("mixed_format");
  if (
    event.venue === "Dimitriou's Jazz Alley"
    || event.venue === "The Triple Door"
    || event.venue === "Bake's Place"
    || event.sourceName === "Chateau Ste. Michelle Summer Concerts"
    || event.sourceName === "Marymoor Park Concerts"
    || event.sourceName === "Woodland Park Zoo / ZooTunes"
  ) {
    tags.push("seated_show");
  }
  if (hasBillSeparator(title)) tags.push("multi_band_bill");
  if (isLocalBandBill(event)) tags.push("local_bill");
  if (event.sourceName === "STG Presents" || event.sourceName === "Climate Pledge Arena" || event.venue === "Neumos" || event.venue === "The Crocodile") {
    tags.push("touring_act");
  }

  const hour = getEventHour(event);
  if (hour !== undefined && hour < 19) tags.push("early_show");
  if (hour !== undefined && hour >= 22) tags.push("late_show");

  return Array.from(new Set(tags));
}

function getPrimaryEventTag(tags: EventTag[]): EventTag | undefined {
  const priority: EventTag[] = [
    "album_release",
    "single_release",
    "ep_release",
    "tribute",
    "benefit",
    "open_mic",
    "jam_night",
    "dance_night",
    "dj_night",
    "mixed_format",
    "legacy_act",
    "seated_show",
    "multi_band_bill",
    "local_bill",
    "touring_act",
    "early_show",
    "late_show"
  ];

  return priority.find((tag) => tags.includes(tag));
}

function getEventLead(tag: EventTag | undefined, event: RankedEvent): string | undefined {
  switch (tag) {
    case "album_release":
      return getReleaseLine(event, "album");
    case "single_release":
      return getReleaseLine(event, "single");
    case "ep_release":
      return getReleaseLine(event, "EP");
    case "tribute":
      return getTributeLine(event);
    case "benefit":
      return getShortVenuePhrase(event, "Benefit concert.");
    case "open_mic":
      return "Open mic night. Good if you want something casual.";
    case "jam_night":
      return "Jam night. Good if you want something loose and player-led.";
    case "dance_night":
      return "Dance night. Check this one if you want a party more than a concert.";
    case "dj_night":
      return "DJ night. Good only if that is the kind of night you want.";
    case "mixed_format":
      return "Mixed-format event. Check the details before you go.";
    case "legacy_act":
      return getShortVenuePhrase(event, "Good choice if you want polished music.");
    case "seated_show":
      return getShortVenuePhrase(event, "Good choice if you want a sit-down show.");
    case "multi_band_bill":
      return getShortVenuePhrase(event, "Multi-band bill.");
    case "local_bill":
      return getShortVenuePhrase(event, "Local-band bill.");
    case "touring_act":
      return isLargeScaleConcertSource(event)
        ? "Big touring show. Good if you already like the artist."
        : getShortVenuePhrase(event, "Touring club show.");
    case "early_show":
      return "Nice early-evening option.";
    case "late_show":
      return getLateShowLine(event);
    default:
      return undefined;
  }
}

function getShortVenuePhrase(event: RankedEvent, fallback: string): string {
  if (event.venue === "Tractor Tavern") return appendContext(fallback, "Tractor for a rootsier kind of night");
  if (event.venue === "The Royal Room") return appendContext(fallback, "The Royal Room");
  if (event.venue === "Bake's Place") return fallback === "Good choice if you want a sit-down show."
    ? "Good Eastside pick for live music."
    : appendContext(fallback, "Bake's Place");
  if (event.venue === "Nectar Lounge") return appendContext(fallback, "Fremont");
  if (event.venue === "Hidden Hall") return appendContext(fallback, "Fremont");
  if (event.venue === "Dimitriou's Jazz Alley") return appendContext(fallback, "Jazz Alley");
  if (event.venue === "The Triple Door") return appendContext(fallback, "The Triple Door");
  if (event.venue === "Skylark Cafe") return appendContext(fallback, "Skylark");
  if (event.venue === "Neumos") return appendContext(fallback, "Neumos");
  if (event.venue === "Barboza") return appendContext(fallback, "Barboza");
  if (event.venue === "Chop Suey") return appendContext(fallback, "Chop Suey");
  if (event.venue === "Conor Byrne Pub") return appendContext(fallback, "Conor Byrne");
  if (event.sourceName === "The Crocodile" || event.venue === "The Crocodile" || event.venue === "Madame Lou's") return appendContext(fallback, "Belltown");
  if (event.venue === "Here - After") return `${fallback} Check the details since Here-After can be mixed-format.`;
  if (event.venue === "SeaMonster Lounge") return appendContext(fallback, "SeaMonster");
  if (event.sourceName === "Marymoor Park Concerts") return appendContext(fallback, "Marymoor");
  if (event.sourceName === "Woodland Park Zoo / ZooTunes") return appendContext(fallback, "ZooTunes");
  if (event.sourceName === "KEXP Events") return appendContext(fallback, "KEXP");
  if (event.venue === "Climate Pledge Arena" || event.sourceName === "Climate Pledge Arena") return appendContext(fallback, "Climate Pledge");
  if (event.sourceName === "STG Presents") return `${fallback} Good if you already like the artist.`;
  if (event.sourceName === "Chateau Ste. Michelle Summer Concerts") return appendContext(fallback, "Chateau Ste. Michelle");
  return fallback;
}

function appendContext(base: string, context: string): string {
  const cleanBase = base.replace(/\.$/, "");
  return `${cleanBase} at ${context}.`;
}

function getReleaseLine(event: RankedEvent, kind: "album" | "single" | "EP"): string {
  if (kind === "album") {
    if (event.venue === "Conor Byrne Pub") return "Cool album release party at Conor Byrne.";
    if (event.venue === "Sunset Tavern") return "Cool album release show at Sunset.";
    return getShortVenuePhrase(event, "Album release show.");
  }

  if (kind === "EP") {
    return getShortVenuePhrase(event, "EP release night.");
  }

  const title = publicText(event.artist ?? event.title);
  const artist = title.split(/\s+\(|\s+w\/|\s+with\s+|\s+\+|,/i)[0]?.trim();
  if (artist && artist.length > 2 && artist.length < 80) {
    return getShortVenuePhrase(event, `Good night to catch ${artist}.`);
  }

  return getShortVenuePhrase(event, "New single night.");
}

function getTributeLine(event: RankedEvent): string {
  const title = publicText(event.artist ?? event.title);
  const tributeTarget = title.match(/\btribute to\s+([^()+,]+?)(?:\s+featuring|\s+with|\)|$)/i)
    ?? title.match(/\btribute.*?:\s*([^()+,]+)/i)
    ?? title.match(/^(.+?)\s+tribute\b/i);
  const artistName = publicText(tributeTarget?.[1]).replace(/\s+night$/i, "");
  const subject = artistName || "this artist";

  if (event.venue === "Skylark Cafe") return `If you like ${subject}, this could be a fun one at Skylark.`;
  if (event.venue === "Conor Byrne Pub") return `If you like ${subject}, this could be a fun one at Conor Byrne.`;
  return getShortVenuePhrase(event, "Tribute show.");
}

function getLateShowLine(event: RankedEvent): string {
  if (event.venue === "SeaMonster Lounge") return "A solid late-night SeaMonster show.";
  if (event.sourceName === "The Crocodile" || event.venue === "The Crocodile" || event.venue === "Madame Lou's") return "Good late-night Belltown show.";
  if (event.venue === "Chop Suey") return "Good late-night Capitol Hill show.";
  return getShortVenuePhrase(event, "Good late-night show.");
}

function getVenueFallbackLine(event: RankedEvent, timeframe: string, variantIndex: number): string {
  const titleLower = publicText(event.title).toLowerCase();

  if (event.venue === "Tractor Tavern") {
    return variantIndex % 2 === 0
      ? "Good Tractor pick for a rootsier kind of night."
      : "Good small-room show at Tractor.";
  }

  if (event.venue === "The Royal Room") {
    if (titleLower.includes("album release")) {
      return "Album release at The Royal Room.";
    }

    return titleLower.includes("trio") || titleLower.includes("jammah") || titleLower.includes("jam")
      ? "Good Royal Room show if you want something loose and player-led."
      : "Check the details if this Royal Room title grabs you.";
  }

  if (event.venue === "Bake's Place") {
    return variantIndex % 2 === 0
      ? "Good Eastside pick for live music."
      : "Good Bellevue dinner-and-show option.";
  }

  if (event.venue === "Nectar Lounge") {
    return variantIndex % 2 === 0
      ? "Good Fremont club show."
      : "Good Nectar show if you want a bigger room.";
  }

  if (event.venue === "Hidden Hall") {
    return "Good Fremont club show.";
  }

  if (event.venue === "Dimitriou's Jazz Alley") {
    return "Good choice if you want polished music at Jazz Alley.";
  }

  if (event.venue === "The Triple Door") {
    return "Good sit-down downtown show.";
  }

  if (event.venue === "Skylark Cafe") {
    return variantIndex % 2 === 0
      ? "Good smaller West Seattle show."
      : "Good Skylark show if you want a neighborhood room.";
  }

  if (event.venue === "Neumos") {
    return "Good Capitol Hill club show.";
  }

  if (event.venue === "Barboza") {
    return "Good smaller Capitol Hill show.";
  }

  if (event.venue === "Chop Suey") {
    return "Good Capitol Hill club show.";
  }

  if (event.venue === "Conor Byrne Pub") {
    return variantIndex % 2 === 0
      ? "Good Ballard pub show."
      : "Good Conor Byrne show if you want a small room.";
  }

  if (event.sourceName === "The Crocodile" || event.venue === "The Crocodile" || event.venue === "Madame Lou's") {
    return "Good Belltown show.";
  }

  if (event.venue === "Here - After") {
    return "Music-looking Here-After event. Check the details first.";
  }

  if (event.venue === "SeaMonster Lounge") {
    return variantIndex % 2 === 0
      ? "A solid SeaMonster show."
      : "Good SeaMonster show.";
  }

  if (event.sourceName === "Marymoor Park Concerts") {
    return "Good outdoor Eastside concert.";
  }

  if (event.sourceName === "Woodland Park Zoo / ZooTunes") {
    return "Good outdoor ZooTunes show.";
  }

  if (event.sourceName === "KEXP Events") {
    return "Good KEXP music event.";
  }

  if (event.venue === "Climate Pledge Arena" || event.sourceName === "Climate Pledge Arena") {
    return "Big arena show. Good if you already like the artist.";
  }

  if (event.sourceName === "STG Presents") {
    return event.classification.musicConfidence === "High"
      ? "Good if you already like the artist."
      : "Bigger-room show. Check a clip first.";
  }

  return `Looks like a decent live-music option for ${timeframe}. Check a clip first.`;
}

function buildWhyLine(event: RankedEvent, timeframe = "tonight", context?: WhyLineContext): string {
  const tags = inferEventTags(event);
  const primaryTag = getPrimaryEventTag(tags);
  const stemKey = primaryTag ? `tag:${primaryTag}` : `venue:${publicText(event.venue || event.sourceName).toLowerCase()}`;
  const usedCount = context?.usedStems.get(stemKey) ?? 0;

  if (context) {
    context.usedStems.set(stemKey, usedCount + 1);
  }

  const lead = getEventLead(primaryTag, event);

  if (lead) {
    return lead;
  }

  return getVenueFallbackLine(event, timeframe, usedCount);
}

function buildSkipReason(event: RankedEvent): string {
  const statusIssueReason = getEventStatusIssueReason(event);
  if (statusIssueReason) {
    return statusIssueReason;
  }

  const blob = getEventTextBlob(event);

  if (!event.classification.isLikelyMusic) {
    if (event.sourceName === "The Royal Room" && event.classification.eventType === "unknown") {
      return "unclear from listing — check details if the title interests you";
    }

    if (event.classification.eventType === "talk" || event.classification.eventType === "comedy") {
      return event.sourceName === "STG Presents"
        ? "appears to be comedy/talk rather than live music"
        : "appears to be comedy/talk rather than live music";
    }

    if (event.classification.eventType === "theater" || event.classification.eventType === "dance") {
      if (event.sourceName === "STG Presents" && /\b(workshop|audition|class|yoga)\b/i.test(event.classification.exclusionReason ?? blob)) {
        return "workshop/audition, not this scout’s target";
      }

      return event.sourceName === "STG Presents"
        ? "theater/ballet/film, not this scout’s target"
        : "probably not a live-music fit";
    }

    if (event.sourceName === "The Royal Room") {
      return "possible music event, but the listing is too sparse to rank confidently";
    }

    if (isMixedFormatPerformance(event)) {
      return "mixed-format performance — not this scout’s main music target";
    }

    if (
      event.sourceName === "Nectar Lounge"
      || event.sourceName === "Hidden Hall"
      || event.sourceName === "Skylark Cafe"
      || event.sourceName === "Bake's Place"
      || event.sourceName === "The Triple Door"
    ) {
      return isLocalBandBill(event)
        ? "local-band listing — check a clip first"
        : "possible music event, but the listing is too sparse to rank confidently";
    }

    return "probably not a live-music fit";
  }

  if (isRecurringJamNight(event)) {
    return "recurring jam night — real music, but not one of the top weekly picks";
  }

  if (isMixedFormatPerformance(event)) {
    return "mixed-format performance — not this scout’s main music target";
  }

  if (event.sourceName === "STG Presents") {
    return hasHarderEdgeCue(blob)
      ? "live music, but probably outside your usual sweet spot"
      : "music event, but not as strong as the better options this week";
  }

  if (
    event.sourceName === "Nectar Lounge"
    || event.sourceName === "Hidden Hall"
    || event.sourceName === "Skylark Cafe"
  ) {
    return isLocalBandBill(event)
      ? "local-band listing — check a clip first"
      : "music event, but not as strong as the better options this week";
  }

  return "music event, but not as strong as the better options this week";
}

function hasHarderEdgeCue(blob: string): boolean {
  return ["metal", "hardcore", "deathcore", "thrash", "punk", "heavy", "helloween"].some((term) => blob.includes(term));
}

function getAvailabilityLine(event: RankedEvent): string | undefined {
  const title = publicText(event.artist ?? event.title).toLowerCase();
  if (title.includes("sold out")) {
    return "Sold out";
  }

  return undefined;
}

function getMyTake(event: RankedEvent): string {
  const availability = getAvailabilityLine(event);

  if (availability === "Sold out") {
    return "Worth tracking, but it’s sold out — check resale or future dates.";
  }

  return formatVerdict(event.verdict);
}

function renderHighlight(event: RankedEvent, context?: WhyLineContext): string {
  const why = buildWhyLine(event, "tonight", context);
  const timeNote = getTimeOfDayNote(event.time);
  const timeLine = timeNote ? `${event.time ?? "Unknown"} (${timeNote})` : (event.time ?? "Unknown");
  const availability = getAvailabilityLine(event);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const location = publicText(event.location ?? "Seattle area");

  const lines = [
    `### ${title}`,
    `- Venue: ${venue}`,
    `- Time: ${timeLine}`,
    `- Location: ${location}`,
    `- Why it looks good: ${publicText(why)}`,
    `- My take: ${publicText(getMyTake(event))}`,
    `- Source: ${formatSourceLinkMarkdown(event)}`
  ];

  if (availability) {
    lines.splice(4, 0, `- Availability: ${availability}`);
  }

  return lines.join("\n");
}

function renderHighlightHtml(event: RankedEvent, context?: WhyLineContext): string {
  const why = buildWhyLine(event, "tonight", context);
  const timeNote = getTimeOfDayNote(event.time);
  const timeLine = timeNote ? `${event.time ?? "Unknown"} (${timeNote})` : (event.time ?? "Unknown");
  const availability = getAvailabilityLine(event);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const location = publicText(event.location ?? "Seattle area");

  const items = [
    `<h3>${escapeHtml(title)}</h3>`,
    "<ul>",
    `<li><strong>Venue:</strong> ${escapeHtml(venue)}</li>`,
    `<li><strong>Time:</strong> ${escapeHtml(timeLine)}</li>`,
    `<li><strong>Location:</strong> ${escapeHtml(location)}</li>`,
    `<li><strong>Why it looks good:</strong> ${escapeHtml(publicText(why))}</li>`,
    `<li><strong>My take:</strong> ${escapeHtml(publicText(getMyTake(event)))}</li>`,
    `<li><strong>Source:</strong> ${formatSourceLinkHtml(event)}</li>`,
    "</ul>"
  ];

  if (availability) {
    items.splice(5, 0, `<li><strong>Availability:</strong> ${escapeHtml(availability)}</li>`);
  }

  return items.join("");
}

function takeWithDiversityCap<T>(
  candidates: T[],
  selected: T[],
  maxItems: number,
  getVenue: (item: T) => string,
  getSource: (item: T) => string,
  maxPerVenue: number,
  maxPerSource: number
): T[] {
  const results: T[] = [];
  const allItems = [...selected, ...candidates];
  const venueDiversityPossible = new Set(allItems.map((item) => publicText(getVenue(item)))).size > 1;
  const sourceDiversityPossible = new Set(allItems.map((item) => publicText(getSource(item)))).size > 1;

  for (const candidate of candidates) {
    if (results.length >= maxItems) {
      break;
    }

    const combined = [...selected, ...results];
    const venueCounts = countBy(combined, (item) => publicText(getVenue(item)));
    const sourceCounts = countBy(combined, (item) => publicText(getSource(item)));
    const venueKey = publicText(getVenue(candidate));
    const sourceKey = publicText(getSource(candidate));

    if (venueDiversityPossible && (venueCounts.get(venueKey) ?? 0) >= maxPerVenue) {
      continue;
    }

    if (sourceDiversityPossible && (sourceCounts.get(sourceKey) ?? 0) >= maxPerSource) {
      continue;
    }

    results.push(candidate);
  }

  return results;
}

export function selectEmailSections(rankedEvents: RankedEvent[]): {
  highlights: RankedEvent[];
  alsoWorthChecking: RankedEvent[];
  remaining: RankedEvent[];
} {
  const highlightCandidates = rankedEvents.filter(
    (event) =>
      event.verdict === "Go"
      && event.classification.isLikelyMusic
      && !hasEventStatusIssue(event)
  );
  const highlights = takeWithDiversityCap(
    highlightCandidates,
    [],
    3,
    (event) => event.venue,
    (event) => event.sourceName,
    MAX_DAILY_HIGHLIGHTS_PER_VENUE,
    MAX_DAILY_HIGHLIGHTS_PER_SOURCE
  );
  const shownHighlightIds = new Set(highlights.map((event) => event.id));
  const fourthCandidate = highlightCandidates.find((event) => !shownHighlightIds.has(event.id));

  if (fourthCandidate && fourthCandidate.score >= 12) {
    const cappedFourth = takeWithDiversityCap(
      [fourthCandidate],
      highlights,
      1,
      (event) => event.venue,
      (event) => event.sourceName,
      MAX_DAILY_HIGHLIGHTS_PER_VENUE,
      MAX_DAILY_HIGHLIGHTS_PER_SOURCE
    );
    highlights.push(...cappedFourth);
  }

  const alsoWorthCheckingCandidates = rankedEvents.filter(
    (event) =>
      event.verdict === "Maybe"
      && event.classification.isLikelyMusic
      && !hasEventStatusIssue(event)
  );
  const alsoWorthChecking = takeWithDiversityCap(
    alsoWorthCheckingCandidates,
    highlights,
    5,
    (event) => event.venue,
    (event) => event.sourceName,
    MAX_DAILY_ALSO_WORTH_PER_VENUE,
    MAX_DAILY_ALSO_WORTH_PER_SOURCE
  );
  const shownIds = new Set([...highlights, ...alsoWorthChecking].map((event) => event.id));
  const remaining = rankedEvents.filter((event) => !shownIds.has(event.id));

  return { highlights, alsoWorthChecking, remaining };
}

function renderEvaluatedItem(event: RankedEvent): string {
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";
  const reason =
    hasEventStatusIssue(event)
      ? `Not highlighted: ${buildSkipReason(event)}.`
      : event.verdict === "Maybe"
      ? "Highlight-worthy, but a lighter fit than the top picks."
      : event.verdict === "Go"
        ? "Not highlighted: good fit, but not one of tonight’s top picks."
        : `Not highlighted: ${buildSkipReason(event)}.`;

  return `- ${title} — ${venue}${timePart} — ${publicText(reason)} ${formatSourceLinkMarkdown(event)}`;
}

function renderEvaluatedItemHtml(event: RankedEvent): string {
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";
  const reason =
    hasEventStatusIssue(event)
      ? `Not highlighted: ${buildSkipReason(event)}.`
      : event.verdict === "Maybe"
      ? "Highlight-worthy, but a lighter fit than the top picks."
      : event.verdict === "Go"
        ? "Not highlighted: good fit, but not one of tonight’s top picks."
        : `Not highlighted: ${buildSkipReason(event)}.`;

  return `<li>${escapeHtml(title)} — ${escapeHtml(venue)}${escapeHtml(timePart)} — ${escapeHtml(publicText(reason))} ${formatSourceLinkHtml(event)}</li>`;
}

function normalizeWeeklyHighlightTitle(value: string): string {
  return publicText(value)
    .toLowerCase()
    .replace(/\b(album release|record release|release show)\s+night\s+\d+\b.*$/g, "$1")
    .replace(/\bsold out!?\b/g, " ")
    .replace(/^[^:]{1,80}\bpresents:\s*/i, "")
    .replace(/\b(both shows|night one|night two|night 1|night 2)\b/g, " ")
    .replace(/[“”"'’‘()[\]{}*.,!?:;/\\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWeeklyHighlightKey(event: RankedEvent): string {
  const titleSource = event.sourceName === "Sunset Tavern" ? event.title : event.artist ?? event.title;
  const title = normalizeWeeklyHighlightTitle(titleSource);
  const venue = publicText(event.venue).toLowerCase();
  return `${venue}::${title}`;
}

function formatWeeklyDateList(dateKeys: string[]): string {
  return dateKeys.map((dateKey) => formatDateKeyShort(dateKey)).join(", ");
}

function formatWeeklyDateLabel(dateKeys: string[]): string {
  return dateKeys.length === 1
    ? `Date: ${formatWeeklyDateList(dateKeys)}`
    : `Dates: ${formatWeeklyDateList(dateKeys)}`;
}

function formatWeeklyDateLabelHtml(dateKeys: string[]): string {
  return dateKeys.length === 1
    ? `<li><strong>Date:</strong> ${escapeHtml(formatWeeklyDateList(dateKeys))}</li>`
    : `<li><strong>Dates:</strong> ${escapeHtml(formatWeeklyDateList(dateKeys))}</li>`;
}

function formatWeeklyTimes(events: RankedEvent[]): string | undefined {
  const times = Array.from(
    new Set(
      events
        .flatMap((event) => (event.time ?? "").split("/"))
        .map((time) => publicText(time))
        .filter(Boolean)
    )
  );

  return times.length > 0 ? times.join(" / ") : undefined;
}

function cleanGroupedHighlightDisplayTitle(value: string): string {
  return publicText(value)
    .replace(/\b(album release|record release|release show)\s+night\s+\d+\b(?:\s+w\/.*)?$/gi, "$1")
    .replace(/\s+\b(BOTH SHOWS|NIGHT ONE|NIGHT TWO|Night 1|Night 2)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAggregateMultiNightListing(event: RankedEvent): boolean {
  return /\bBOTH SHOWS\b/i.test(publicText(event.artist ?? event.title));
}

function isGenericRoyalRoomHappyHour(event: RankedEvent): boolean {
  if (event.venue !== "The Royal Room" && event.sourceName !== "The Royal Room") {
    return false;
  }

  const title = publicText(event.artist ?? event.title).toLowerCase();

  if (!title.includes("happy hour")) {
    return false;
  }

  return !(
    /\b(album release|record release|release show|trio|quartet|quintet|sextet|septet|ensemble|orchestra|band)\b/.test(title)
    || /\bw\//.test(title)
    || /\bfeat\.?\b/.test(title)
    || /\bplays the music\b/.test(title)
  );
}

function isGenericConorByrneCommunityEvent(event: RankedEvent): boolean {
  if (event.venue !== "Conor Byrne Pub" && event.sourceName !== "Conor Byrne Pub") {
    return false;
  }

  const title = publicText(event.artist ?? event.title).toLowerCase();

  if (/\b(album release|record release|release show)\b/.test(title)) {
    return false;
  }

  if (/\b(song share|open mic|dance night|lindy hop|lesson|lessons)\b/.test(title)) {
    return true;
  }

  return false;
}

function getWeeklyHighlightGroupScore(group: WeeklyHighlightGroup): number {
  const uniqueDates = new Set(group.events.map((event) => event.date)).size;
  const multiNightBonus = uniqueDates > 1 ? Math.min(uniqueDates - 1, 2) * 3 + 1 : 0;
  return group.representative.score + multiNightBonus;
}

function countBy<T>(items: T[], getKey: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function buildWeeklyGroupTake(group: WeeklyHighlightGroup): string {
  const allSoldOut = group.events.every((event) => getAvailabilityLine(event) === "Sold out");

  if (allSoldOut) {
    return "Worth tracking, but it’s sold out — check resale or future dates.";
  }

  if (group.events.length > 1) {
    return "Good weekly planning option — pick the date that works best.";
  }

  return getMyTake(group.representative);
}

function renderWeeklyHighlight(group: WeeklyHighlightGroup, context?: WhyLineContext): string {
  const representative = group.representative;
  const titleSource = group.events.length > 1 ? representative.title : representative.artist ?? representative.title;
  const title = cleanGroupedHighlightDisplayTitle(titleSource);
  const venue = publicText(representative.venue);
  const location = publicText(representative.location ?? "Seattle area");
  const dates = Array.from(new Set(group.events.map((event) => event.date))).sort();
  const times = formatWeeklyTimes(group.events);
  const availability = group.events.every((event) => getAvailabilityLine(event) === "Sold out") ? "Sold out" : undefined;

  return [
    `### ${title}`,
    `- Venue: ${venue}`,
    `- ${formatWeeklyDateLabel(dates)}`,
    times ? `- ${dates.length === 1 ? "Time" : "Times"}: ${times}` : undefined,
    `- Location: ${location}`,
    availability ? `- Availability: ${availability}` : undefined,
    `- Why it looks good: ${publicText(buildWhyLine(representative, "this week", context))}`,
    `- My take: ${publicText(buildWeeklyGroupTake(group))}`,
    `- Source: ${formatSourceLinkMarkdown(representative)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function getEmailImageUrl(event: RankedEvent): string | undefined {
  if (!event.imageUrl?.startsWith("https://")) {
    return undefined;
  }

  return event.imageUrl;
}

function renderWeeklyHighlightHtml(group: WeeklyHighlightGroup, context?: WhyLineContext, includeImage = false): string {
  const representative = group.representative;
  const titleSource = group.events.length > 1 ? representative.title : representative.artist ?? representative.title;
  const title = cleanGroupedHighlightDisplayTitle(titleSource);
  const venue = publicText(representative.venue);
  const location = publicText(representative.location ?? "Seattle area");
  const dates = Array.from(new Set(group.events.map((event) => event.date))).sort();
  const times = formatWeeklyTimes(group.events);
  const availability = group.events.every((event) => getAvailabilityLine(event) === "Sold out") ? "Sold out" : undefined;
  const imageUrl = includeImage ? getEmailImageUrl(representative) : undefined;
  const content = [
    `<h3>${escapeHtml(title)}</h3>`,
    "<ul>",
    `<li><strong>Venue:</strong> ${escapeHtml(venue)}</li>`,
    formatWeeklyDateLabelHtml(dates),
    times ? `<li><strong>${dates.length === 1 ? "Time" : "Times"}:</strong> ${escapeHtml(times)}</li>` : undefined,
    `<li><strong>Location:</strong> ${escapeHtml(location)}</li>`,
    availability ? `<li><strong>Availability:</strong> ${escapeHtml(availability)}</li>` : undefined,
    `<li><strong>Why it looks good:</strong> ${escapeHtml(publicText(buildWhyLine(representative, "this week", context)))}</li>`,
    `<li><strong>My take:</strong> ${escapeHtml(publicText(buildWeeklyGroupTake(group)))}</li>`,
    `<li><strong>Source:</strong> ${formatSourceLinkHtml(representative)}</li>`,
    "</ul>"
  ]
    .filter(Boolean)
    .join("");

  if (!imageUrl) {
    return content;
  }

  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin:0 0 16px 0;">',
    "<tr>",
    '<td style="width:116px; padding:4px 16px 8px 0; vertical-align:top;">',
    `<img src="${escapeHtml(imageUrl)}" width="112" alt="" role="presentation" style="display:block; width:112px; max-width:112px; height:auto; border-radius:4px;">`,
    "</td>",
    '<td style="vertical-align:top;">',
    content,
    "</td>",
    "</tr>",
    "</table>"
  ].join("");
}

export function selectWeeklyEmailSections(rankedEvents: RankedEvent[]): {
  highlights: WeeklyHighlightGroup[];
  alsoWorthALook: WeeklyHighlightGroup[];
  evaluatedByDay: Map<string, RankedEvent[]>;
  highlightIds: Set<string>;
  alsoWorthALookIds: Set<string>;
} {
  const highlightCandidates = rankedEvents
    .filter(
      (event) =>
        (event.verdict === "Go" || event.verdict === "Maybe")
        && event.classification.isLikelyMusic
        && !hasEventStatusIssue(event)
        && (!isRecurringJamNight(event) || event.score >= 12)
        && (!isMixedFormatPerformance(event) || event.score >= 12)
        && !isGenericRoyalRoomHappyHour(event)
        && !isGenericConorByrneCommunityEvent(event)
    );
  const groupedHighlights = new Map<string, WeeklyHighlightGroup>();

  for (const event of highlightCandidates) {
    const key = getWeeklyHighlightKey(event);
    const existing = groupedHighlights.get(key);

    if (existing) {
      existing.events.push(event);
      if (event.score > existing.representative.score) {
        existing.representative = event;
      }
      continue;
    }

    groupedHighlights.set(key, {
      key,
      representative: event,
      events: [event]
    });
  }

  const sortedGroups = Array.from(groupedHighlights.values())
    .sort((a, b) => getWeeklyHighlightGroupScore(b) - getWeeklyHighlightGroupScore(a) || a.representative.title.localeCompare(b.representative.title));
  const highlights: WeeklyHighlightGroup[] = [];
  const venueDiversityPossible = new Set(sortedGroups.map((group) => publicText(group.representative.venue))).size > 1;
  const sourceDiversityPossible = new Set(sortedGroups.map((group) => publicText(group.representative.sourceName))).size > 1;

  for (let index = 0; index < sortedGroups.length; index += 1) {
    if (highlights.length >= MAX_WEEKLY_HIGHLIGHTS) {
      break;
    }

    const group = sortedGroups[index];
    const venueCounts = countBy(highlights, (item) => publicText(item.representative.venue));
    const sourceCounts = countBy(highlights, (item) => publicText(item.representative.sourceName));
    const venueKey = publicText(group.representative.venue);
    const sourceKey = publicText(group.representative.sourceName);
    const venueOverCap = venueDiversityPossible && (venueCounts.get(venueKey) ?? 0) >= MAX_WEEKLY_HIGHLIGHTS_PER_VENUE;
    const sourceOverCap = sourceDiversityPossible && (sourceCounts.get(sourceKey) ?? 0) >= MAX_WEEKLY_HIGHLIGHTS_PER_SOURCE;
    const largeScaleCount = highlights.filter((item) => isLargeScaleConcertSource(item.representative)).length;
    const largeScaleOverCap = isLargeScaleConcertSource(group.representative)
      && largeScaleCount >= MAX_WEEKLY_HIGHLIGHTS_LARGE_SCALE
      && sortedGroups.slice(index + 1).some((candidate) => !isLargeScaleConcertSource(candidate.representative));

    if (!venueOverCap && !sourceOverCap && !largeScaleOverCap) {
      highlights.push(group);
      continue;
    }

    const remainingAlternatives = sortedGroups.slice(index + 1).filter((candidate) => {
      const candidateVenue = publicText(candidate.representative.venue);
      const candidateSource = publicText(candidate.representative.sourceName);
      return candidateVenue !== venueKey || candidateSource !== sourceKey;
    });

    if (remainingAlternatives.length === 0) {
      highlights.push(group);
      continue;
    }

    const bestAlternativeScore = getWeeklyHighlightGroupScore(remainingAlternatives[0]);
    const groupScore = getWeeklyHighlightGroupScore(group);
    const isMultiNightRun = new Set(group.events.map((event) => event.date)).size > 1;

    if (!largeScaleOverCap && isMultiNightRun && groupScore >= bestAlternativeScore + WEEKLY_DIVERSITY_OVERRIDE_GAP) {
      highlights.push(group);
    }
  }

  const highlightKeys = new Set(highlights.map((group) => group.key));
  const alsoWorthALook: WeeklyHighlightGroup[] = [];

  for (const group of sortedGroups) {
    if (highlightKeys.has(group.key) || alsoWorthALook.length >= MAX_WEEKLY_ALSO_WORTH) {
      continue;
    }

    const venueCounts = countBy(alsoWorthALook, (item) => publicText(item.representative.venue));
    const sourceCounts = countBy(alsoWorthALook, (item) => publicText(item.representative.sourceName));
    const combinedVenueCounts = countBy([...highlights, ...alsoWorthALook], (item) => publicText(item.representative.venue));
    const combinedSourceCounts = countBy([...highlights, ...alsoWorthALook], (item) => publicText(item.representative.sourceName));
    const combinedLargeScaleCount = [...highlights, ...alsoWorthALook]
      .filter((item) => isLargeScaleConcertSource(item.representative))
      .length;
    const venueKey = publicText(group.representative.venue);
    const sourceKey = publicText(group.representative.sourceName);

    if (
      (venueCounts.get(venueKey) ?? 0) >= MAX_WEEKLY_ALSO_WORTH_PER_VENUE
      || (sourceCounts.get(sourceKey) ?? 0) >= MAX_WEEKLY_ALSO_WORTH_PER_SOURCE
      || (combinedVenueCounts.get(venueKey) ?? 0) >= MAX_WEEKLY_TOP_SECTIONS_PER_VENUE
      || (combinedSourceCounts.get(sourceKey) ?? 0) >= MAX_WEEKLY_TOP_SECTIONS_PER_SOURCE
      || (
        isLargeScaleConcertSource(group.representative)
        && combinedLargeScaleCount >= MAX_WEEKLY_TOP_SECTIONS_LARGE_SCALE
      )
    ) {
      continue;
    }

    alsoWorthALook.push(group);
  }

  const highlightIds = new Set(highlights.flatMap((group) => group.events.map((event) => event.id)));
  const alsoWorthALookIds = new Set(alsoWorthALook.flatMap((group) => group.events.map((event) => event.id)));
  const evaluatedByDay = new Map<string, RankedEvent[]>();
  const aggregateMultiNightKeysWithNightlyEntries = new Set(
    rankedEvents
      .filter((event) => !isAggregateMultiNightListing(event) && /\bNIGHT (?:ONE|TWO|1|2)\b/i.test(publicText(event.artist ?? event.title)))
      .map((event) => getWeeklyHighlightKey(event))
  );

  for (const event of rankedEvents) {
    if (isAggregateMultiNightListing(event) && aggregateMultiNightKeysWithNightlyEntries.has(getWeeklyHighlightKey(event))) {
      continue;
    }

    const existing = evaluatedByDay.get(event.date) ?? [];
    existing.push(event);
    evaluatedByDay.set(event.date, existing);
  }

  return { highlights, alsoWorthALook, evaluatedByDay, highlightIds, alsoWorthALookIds };
}

function renderWeeklyEvaluatedItem(event: RankedEvent, isHighlighted: boolean, isAlsoWorthALook = false): string {
  const reason = getWeeklyEvaluatedReason(event, isHighlighted, isAlsoWorthALook);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";

  return `- ${title} — ${venue}${timePart} — ${publicText(reason)} ${formatSourceLinkMarkdown(event)}`;
}

function renderWeeklyEvaluatedItemHtml(event: RankedEvent, isHighlighted: boolean, isAlsoWorthALook = false): string {
  const reason = getWeeklyEvaluatedReason(event, isHighlighted, isAlsoWorthALook);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";

  return `<li>${escapeHtml(title)} — ${escapeHtml(venue)}${escapeHtml(timePart)} — ${escapeHtml(publicText(reason))} ${formatSourceLinkHtml(event)}</li>`;
}

function renderWeeklyEvaluatedSections(
  evaluatedByDay: Map<string, RankedEvent[]>,
  highlightIds: Set<string>,
  alsoWorthALookIds: Set<string>
): string[] {
  const sections = ["", "## Evaluated Shows by Day"];

  if (evaluatedByDay.size === 0) {
    sections.push("No other evaluated shows in this window.");
    return sections;
  }

  for (const [dateKey, events] of Array.from(evaluatedByDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    sections.push("");
    sections.push(`### ${formatDateKeyWeekday(dateKey)}`);
    sections.push(events.map((event) => renderWeeklyEvaluatedItem(event, highlightIds.has(event.id), alsoWorthALookIds.has(event.id))).join("\n"));
  }

  return sections;
}

function renderWeeklyEvaluatedSectionsHtml(
  evaluatedByDay: Map<string, RankedEvent[]>,
  highlightIds: Set<string>,
  alsoWorthALookIds: Set<string>
): string {
  return [
    "<h2>Evaluated Shows by Day</h2>",
    evaluatedByDay.size === 0
      ? "<p>No other evaluated shows in this window.</p>"
      : Array.from(evaluatedByDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([dateKey, events]) =>
              `<h3>${escapeHtml(formatDateKeyWeekday(dateKey))}</h3><ul>${events.map((event) => renderWeeklyEvaluatedItemHtml(event, highlightIds.has(event.id), alsoWorthALookIds.has(event.id))).join("")}</ul>`
          )
          .join("")
  ].join("");
}

function formatSlackDateRange(startKey: string, endKey: string): string {
  return `${formatDateKeyShort(startKey)} – ${formatDateKeyShort(endKey)}, ${endKey.slice(0, 4)}`;
}

function formatWeeklyDateLabelSlack(dates: string[]): string {
  return dates.length === 1
    ? formatDateKeyShort(dates[0])
    : dates.map((date) => formatDateKeyShort(date)).join(" / ");
}

function renderWeeklyHighlightSlack(group: WeeklyHighlightGroup, context?: WhyLineContext): string {
  const representative = group.representative;
  const titleSource = group.events.length > 1 ? representative.title : representative.artist ?? representative.title;
  const title = cleanGroupedHighlightDisplayTitle(titleSource);
  const venue = publicText(representative.venue);
  const dates = Array.from(new Set(group.events.map((event) => event.date))).sort();
  const times = formatWeeklyTimes(group.events);
  const dateLine = [formatWeeklyDateLabelSlack(dates), times].filter(Boolean).join(" · ");
  const availability = group.events.every((event) => getAvailabilityLine(event) === "Sold out") ? "Sold out" : undefined;
  const why = publicText(buildWhyLine(representative, "this week", context));
  const take = publicText(buildWeeklyGroupTake(group));

  return [
    `*${escapeSlackText(title)}* — ${escapeSlackText(venue)}`,
    dateLine ? escapeSlackText(dateLine) : undefined,
    availability ? `Availability: ${escapeSlackText(availability)}` : undefined,
    `${escapeSlackText(why)} ${escapeSlackText(take)}`,
    `Source: ${formatSourceLinkSlack(representative)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function renderWeeklyAlsoWorthSlack(group: WeeklyHighlightGroup): string {
  const representative = group.representative;
  const titleSource = group.events.length > 1 ? representative.title : representative.artist ?? representative.title;
  const title = cleanGroupedHighlightDisplayTitle(titleSource);
  const venue = publicText(representative.venue);
  const dates = Array.from(new Set(group.events.map((event) => event.date))).sort();
  const times = formatWeeklyTimes(group.events);
  const details = [venue, formatWeeklyDateLabelSlack(dates), times].filter(Boolean).map(escapeSlackText);
  return `• ${escapeSlackText(title)} — ${details.join(" — ")} — ${formatSourceLinkSlack(representative)}`;
}

function renderWeeklyEvaluatedItemSlack(event: RankedEvent, isHighlighted: boolean, isAlsoWorthALook = false): string {
  const reason = getWeeklyEvaluatedReason(event, isHighlighted, isAlsoWorthALook);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const heading = [venue, event.time].filter(Boolean).map(escapeSlackText).join(" — ");
  const headingSuffix = heading ? ` — ${heading}` : "";
  return [
    `• *${escapeSlackText(title)}*${headingSuffix}`,
    `  ${escapeSlackText(reason)}`,
    `  ${formatSourceLinkSlack(event)}`
  ].join("\n");
}

export function generateWeeklySlackReport(
  rankedEvents: RankedEvent[],
  startKey: string,
  endKey: string,
  options: WeeklyEmailOptions = {}
): string {
  const { highlights, alsoWorthALook, evaluatedByDay, highlightIds, alsoWorthALookIds } = selectWeeklyEmailSections(rankedEvents);
  const includeEvaluatedShows = options.includeEvaluatedShows ?? false;
  const highlightsWhyContext = createWhyLineContext();
  const sections: string[] = [
    "*Live Music Scout — This Week around Seattle/Bellevue*",
    `_${escapeSlackText(formatSlackDateRange(startKey, endKey))}_`,
    "",
    "*This Week’s Highlights*",
    "",
    highlights.length > 0
      ? highlights.map((group) => renderWeeklyHighlightSlack(group, highlightsWhyContext)).join("\n\n")
      : "No strong highlights this week."
  ];

  if (alsoWorthALook.length > 0) {
    sections.push("");
    sections.push("*Also Worth a Look*");
    sections.push(alsoWorthALook.map(renderWeeklyAlsoWorthSlack).join("\n"));
  }

  if (includeEvaluatedShows) {
    sections.push("");
    sections.push("*Evaluated Shows by Day*");

    if (evaluatedByDay.size === 0) {
      sections.push("No other evaluated shows in this window.");
    } else {
      for (const [dateKey, events] of Array.from(evaluatedByDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        sections.push("");
        sections.push(`*${escapeSlackText(formatDateKeyWeekday(dateKey))}*`);
        sections.push(events.map((event) => renderWeeklyEvaluatedItemSlack(event, highlightIds.has(event.id), alsoWorthALookIds.has(event.id))).join("\n"));
      }
    }
  }

  sections.push("");
  sections.push("_Evaluated from configured venue sources; not a complete citywide calendar._");

  return sections.join("\n");
}

function getWeeklyEvaluatedReason(event: RankedEvent, isHighlighted: boolean, isAlsoWorthALook = false): string {
  if (isHighlighted) {
    return "Highlighted above.";
  }

  if (isAlsoWorthALook) {
    return "Also worth a look above.";
  }

  if (hasEventStatusIssue(event)) {
    return `Not highlighted: ${buildSkipReason(event)}.`;
  }

  if (isRecurringJamNight(event)) {
    return "Not highlighted: recurring jam night — real music, but not one of the top weekly picks.";
  }

  if (isMixedFormatPerformance(event)) {
    return "Not highlighted: mixed-format performance — not this scout’s main music target.";
  }

  if (isLocalBandBill(event) && event.verdict !== "Go") {
    return "Not highlighted: local-band listing — check a clip first.";
  }

  const skipReason = buildSkipReason(event);

  if (event.verdict === "Maybe") {
    if (skipReason === "live music, but probably outside your usual sweet spot") {
      return "Not highlighted: live music, but probably outside your usual sweet spot.";
    }

    if (skipReason === "music event, but not as strong as the better options this week") {
      return "Not highlighted: maybe — check a clip first.";
    }

    return `Not highlighted: ${skipReason}.`;
  }

  if (event.verdict === "Go") {
    return "Not highlighted: good fit, but not one of the top weekly picks.";
  }

  return `Not highlighted: ${skipReason}.`;
}

export function generateEmailPreview(now: Date, rankedEvents: RankedEvent[]): string {
  const { highlights, alsoWorthChecking, remaining } = selectEmailSections(rankedEvents);
  const highlightsWhyContext = createWhyLineContext();
  const alsoWorthWhyContext = createWhyLineContext();

  const sections: string[] = [
    "Subject: Live Music Scout — Tonight around Seattle/Bellevue",
    "",
    `Date: ${formatTonightLong(now)}`,
    "",
    "## Tonight’s Highlights",
    highlights.length > 0 ? highlights.map((event) => renderHighlight(event, highlightsWhyContext)).join("\n\n") : "No strong highlights tonight."
  ];

  if (alsoWorthChecking.length > 0) {
    sections.push("");
    sections.push("## Also Worth Checking");
    sections.push(alsoWorthChecking.map((event) => renderHighlight(event, alsoWorthWhyContext)).join("\n\n"));
  }

  sections.push("");
  sections.push("## All Evaluated Shows");
  sections.push(
    remaining.length > 0
      ? remaining.map(renderEvaluatedItem).join("\n")
      : "No other evaluated shows tonight."
  );
  sections.push("");
  sections.push("Evaluated from the configured venue sources; not a complete citywide calendar.");

  return sections.join("\n");
}

export function generateEmailHtml(now: Date, rankedEvents: RankedEvent[]): string {
  const { highlights, alsoWorthChecking, remaining } = selectEmailSections(rankedEvents);
  const highlightsWhyContext = createWhyLineContext();
  const alsoWorthWhyContext = createWhyLineContext();

  return [
    "<!doctype html>",
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 24px;">',
    `<p><strong>Subject:</strong> Live Music Scout — Tonight around Seattle/Bellevue</p>`,
    `<p><strong>Date:</strong> ${escapeHtml(formatTonightLong(now))}</p>`,
    "<h2>Tonight’s Highlights</h2>",
    highlights.length > 0 ? highlights.map((event) => renderHighlightHtml(event, highlightsWhyContext)).join("") : "<p>No strong highlights tonight.</p>",
    alsoWorthChecking.length > 0
      ? `<h2>Also Worth Checking</h2>${alsoWorthChecking.map((event) => renderHighlightHtml(event, alsoWorthWhyContext)).join("")}`
      : "",
    "<h2>All Evaluated Shows</h2>",
    remaining.length > 0
      ? `<ul>${remaining.map(renderEvaluatedItemHtml).join("")}</ul>`
      : "<p>No other evaluated shows tonight.</p>",
    "<p><em>Evaluated from the configured venue sources; not a complete citywide calendar.</em></p>",
    "</body></html>"
  ].join("");
}

export function generateWeeklyEmailPreview(
  now: Date,
  rankedEvents: RankedEvent[],
  startKey: string,
  endKey: string,
  options: WeeklyEmailOptions = {}
): string {
  const { highlights, alsoWorthALook, evaluatedByDay, highlightIds, alsoWorthALookIds } = selectWeeklyEmailSections(rankedEvents);
  const includeEvaluatedShows = options.includeEvaluatedShows ?? true;
  const highlightsWhyContext = createWhyLineContext();
  const alsoWorthWhyContext = createWhyLineContext();
  const sections: string[] = [
    "Subject: Live Music Scout — This Week around Seattle/Bellevue",
    "",
    `Date range: ${formatDateRangeLong(startKey, endKey)}`,
    "",
    "## This Week’s Highlights",
    highlights.length > 0 ? highlights.map((group) => renderWeeklyHighlight(group, highlightsWhyContext)).join("\n\n") : "No strong highlights this week."
  ];

  if (alsoWorthALook.length > 0) {
    sections.push("");
    sections.push("## Also Worth a Look");
    sections.push(alsoWorthALook.map((group) => renderWeeklyHighlight(group, alsoWorthWhyContext)).join("\n\n"));
  }

  if (includeEvaluatedShows) {
    sections.push(...renderWeeklyEvaluatedSections(evaluatedByDay, highlightIds, alsoWorthALookIds));
  }

  sections.push("");
  sections.push("Evaluated from the configured venue sources; not a complete citywide calendar.");

  return sections.join("\n");
}

export function generateWeeklyEmailHtml(
  now: Date,
  rankedEvents: RankedEvent[],
  startKey: string,
  endKey: string,
  options: WeeklyEmailOptions = {}
): string {
  const { highlights, alsoWorthALook, evaluatedByDay, highlightIds, alsoWorthALookIds } = selectWeeklyEmailSections(rankedEvents);
  const includeEvaluatedShows = options.includeEvaluatedShows ?? true;
  const highlightsWhyContext = createWhyLineContext();
  const alsoWorthWhyContext = createWhyLineContext();

  return [
    "<!doctype html>",
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 24px;">',
    "<p><strong>Subject:</strong> Live Music Scout — This Week around Seattle/Bellevue</p>",
    `<p><strong>Date range:</strong> ${escapeHtml(formatDateRangeLong(startKey, endKey))}</p>`,
    "<h2>This Week’s Highlights</h2>",
    highlights.length > 0 ? highlights.map((group) => renderWeeklyHighlightHtml(group, highlightsWhyContext, true)).join("") : "<p>No strong highlights this week.</p>",
    alsoWorthALook.length > 0
      ? `<h2>Also Worth a Look</h2>${alsoWorthALook.map((group) => renderWeeklyHighlightHtml(group, alsoWorthWhyContext, true)).join("")}`
      : "",
    includeEvaluatedShows ? renderWeeklyEvaluatedSectionsHtml(evaluatedByDay, highlightIds, alsoWorthALookIds) : "",
    "<p><em>Evaluated from the configured venue sources; not a complete citywide calendar.</em></p>",
    "</body></html>"
  ].join("");
}
