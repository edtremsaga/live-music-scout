import { cleanDisplayText, formatDateKeyShort, formatDateKeyWeekday, formatDateRangeLong, formatTonightLong, getTimeOfDayNote } from "./dateUtils.js";
import { getEventStatusIssueReason, hasEventStatusIssue } from "./eventStatus.js";
import type { RankedEvent } from "./types.js";

type WeeklyHighlightGroup = {
  key: string;
  representative: RankedEvent;
  events: RankedEvent[];
};

const MAX_WEEKLY_HIGHLIGHTS = 8;
const MAX_WEEKLY_HIGHLIGHTS_PER_VENUE = 2;
const MAX_WEEKLY_HIGHLIGHTS_PER_SOURCE = 2;
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
    (event.sourceName === "Skylark Cafe" || event.sourceName === "Hidden Hall" || event.sourceName === "Nectar Lounge")
    && (title.includes(",") || /\bw\/\b/i.test(title) || /\bwith\b/i.test(title))
    && !blob.includes("dj ")
  );
}

function isMixedFormatPerformance(event: RankedEvent): boolean {
  const blob = getEventTextBlob(event);
  return blob.includes("dina martina");
}

export function getSourceLinkLabel(event: Pick<RankedEvent, "url" | "sourceName" | "venue">): string {
  const url = event.url.toLowerCase();

  if (event.venue === "Tractor Tavern" || event.sourceName === "Tractor Tavern") {
    return "Tractor/TicketWeb listing";
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

function formatVerdict(verdict: RankedEvent["verdict"]): string {
  if (verdict === "Go") {
    return "Go if tickets are available.";
  }

  if (verdict === "Maybe") {
    return "Maybe — check a clip first.";
  }

  return "Skip — probably not the kind of live music night this scout is looking for.";
}

function buildWhyLine(event: RankedEvent): string {
  const titleLower = publicText(event.title).toLowerCase();

  if (event.venue === "Tractor Tavern") {
    return titleLower.includes("album release")
      ? "A rootsy album-release show at Tractor Tavern — the kind of small-room live music night that is usually worth a look."
      : "A rootsy, guitar-forward show at Tractor Tavern — the kind of small-room live music night that is usually worth a look.";
  }

  if (event.venue === "The Royal Room") {
    if (titleLower.includes("album release")) {
      return "An album-release night at The Royal Room with a stronger musicianship-first feel than a generic listing.";
    }

    return titleLower.includes("trio") || titleLower.includes("jammah") || titleLower.includes("jam")
      ? "A likely groove/jam-oriented Royal Room show in a comfortable room with strong local-musician energy."
      : "A Royal Room date that seems musically promising, though the listing itself is fairly light on detail.";
  }

  if (event.venue === "Bake's Place") {
    return "An Eastside listening-room style booking at Bake’s Place — a good option if you want a Bellevue-area dinner-and-show night with strong musicianship.";
  }

  if (event.venue === "Nectar Lounge") {
    return "A Nectar Lounge booking with strong club-show energy — worth a look if you want a fuller Fremont room and a more groove-forward night.";
  }

  if (event.venue === "Hidden Hall") {
    return "A Hidden Hall booking with a bigger Fremont-room feel — promising if you want a ticketed club night built around the artist lineup.";
  }

  if (event.venue === "Dimitriou's Jazz Alley") {
    return "A seated Jazz Alley date with a strong musicianship-first feel — a good option if you want a more focused listening-room night.";
  }

  if (event.venue === "The Triple Door") {
    return "A seated Triple Door show with strong listening-room potential — a good option if you want a more focused downtown concert night.";
  }

  if (event.venue === "Skylark Cafe") {
    return "A local-band Skylark night with strong West Seattle club energy — a good option if you want something smaller, scrappier, and close to the neighborhood scene.";
  }

  if (event.sourceName === "STG Presents") {
    return event.classification.musicConfidence === "High"
      ? "A bigger-room concert option. Worth a look if the artist already appeals to you."
      : "A bigger-room concert option. Worth checking only if the artist already appeals to you.";
  }

  return "Looks like a plausible live-music option for tonight, but probably worth a quick spot-check before heading out.";
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

function renderHighlight(event: RankedEvent): string {
  const why = buildWhyLine(event);
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

function renderHighlightHtml(event: RankedEvent): string {
  const why = buildWhyLine(event);
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

function selectEmailSections(rankedEvents: RankedEvent[]): {
  highlights: RankedEvent[];
  remaining: RankedEvent[];
  noStrongMatches: boolean;
} {
  const highlights = rankedEvents
    .filter(
      (event) =>
        (event.verdict === "Go" || event.verdict === "Maybe")
        && event.classification.isLikelyMusic
        && !hasEventStatusIssue(event)
      )
    .slice(0, 5);
  const noStrongMatches = highlights.length === 0;
  const remaining = rankedEvents.filter((event) => !highlights.some((picked) => picked.id === event.id));

  return { highlights, remaining, noStrongMatches };
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
        ? "Strong fit, but already covered in the highlights."
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
        ? "Strong fit, but already covered in the highlights."
        : `Not highlighted: ${buildSkipReason(event)}.`;

  return `<li>${escapeHtml(title)} — ${escapeHtml(venue)}${escapeHtml(timePart)} — ${escapeHtml(publicText(reason))} ${formatSourceLinkHtml(event)}</li>`;
}

function normalizeWeeklyHighlightTitle(value: string): string {
  return publicText(value)
    .toLowerCase()
    .replace(/\bsold out!?\b/g, " ")
    .replace(/^[^:]{1,80}\bpresents:\s*/i, "")
    .replace(/\b(both shows|night one|night two|night 1|night 2)\b/g, " ")
    .replace(/[“”"'’‘()[\]{}*.,!?:;/\\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWeeklyHighlightKey(event: RankedEvent): string {
  const title = normalizeWeeklyHighlightTitle(event.artist ?? event.title);
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
    .replace(/\s+\b(BOTH SHOWS|NIGHT ONE|NIGHT TWO|Night 1|Night 2)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAggregateMultiNightListing(event: RankedEvent): boolean {
  return /\bBOTH SHOWS\b/i.test(publicText(event.artist ?? event.title));
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

function renderWeeklyHighlight(group: WeeklyHighlightGroup): string {
  const representative = group.representative;
  const title = cleanGroupedHighlightDisplayTitle(representative.artist ?? representative.title);
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
    `- Why it looks good: ${publicText(buildWhyLine(representative))}`,
    `- My take: ${publicText(buildWeeklyGroupTake(group))}`,
    `- Source: ${formatSourceLinkMarkdown(representative)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function renderWeeklyHighlightHtml(group: WeeklyHighlightGroup): string {
  const representative = group.representative;
  const title = cleanGroupedHighlightDisplayTitle(representative.artist ?? representative.title);
  const venue = publicText(representative.venue);
  const location = publicText(representative.location ?? "Seattle area");
  const dates = Array.from(new Set(group.events.map((event) => event.date))).sort();
  const times = formatWeeklyTimes(group.events);
  const availability = group.events.every((event) => getAvailabilityLine(event) === "Sold out") ? "Sold out" : undefined;

  return [
    `<h3>${escapeHtml(title)}</h3>`,
    "<ul>",
    `<li><strong>Venue:</strong> ${escapeHtml(venue)}</li>`,
    formatWeeklyDateLabelHtml(dates),
    times ? `<li><strong>${dates.length === 1 ? "Time" : "Times"}:</strong> ${escapeHtml(times)}</li>` : undefined,
    `<li><strong>Location:</strong> ${escapeHtml(location)}</li>`,
    availability ? `<li><strong>Availability:</strong> ${escapeHtml(availability)}</li>` : undefined,
    `<li><strong>Why it looks good:</strong> ${escapeHtml(publicText(buildWhyLine(representative)))}</li>`,
    `<li><strong>My take:</strong> ${escapeHtml(publicText(buildWeeklyGroupTake(group)))}</li>`,
    `<li><strong>Source:</strong> ${formatSourceLinkHtml(representative)}</li>`,
    "</ul>"
  ]
    .filter(Boolean)
    .join("");
}

function selectWeeklyEmailSections(rankedEvents: RankedEvent[]): {
  highlights: WeeklyHighlightGroup[];
  evaluatedByDay: Map<string, RankedEvent[]>;
  highlightIds: Set<string>;
} {
  const highlightCandidates = rankedEvents
    .filter(
      (event) =>
        (event.verdict === "Go" || event.verdict === "Maybe")
        && event.classification.isLikelyMusic
        && !hasEventStatusIssue(event)
        && (!isRecurringJamNight(event) || event.score >= 12)
        && (!isMixedFormatPerformance(event) || event.score >= 12)
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

    if (!venueOverCap && !sourceOverCap) {
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

    if (isMultiNightRun && groupScore >= bestAlternativeScore + WEEKLY_DIVERSITY_OVERRIDE_GAP) {
      highlights.push(group);
    }
  }

  const highlightIds = new Set(highlights.flatMap((group) => group.events.map((event) => event.id)));
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

  return { highlights, evaluatedByDay, highlightIds };
}

function renderWeeklyEvaluatedItem(event: RankedEvent, isHighlighted: boolean): string {
  const reason = getWeeklyEvaluatedReason(event, isHighlighted);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";

  return `- ${title} — ${venue}${timePart} — ${publicText(reason)} ${formatSourceLinkMarkdown(event)}`;
}

function renderWeeklyEvaluatedItemHtml(event: RankedEvent, isHighlighted: boolean): string {
  const reason = getWeeklyEvaluatedReason(event, isHighlighted);
  const title = publicText(event.artist ?? event.title);
  const venue = publicText(event.venue);
  const timePart = event.time ? ` — ${event.time}` : "";

  return `<li>${escapeHtml(title)} — ${escapeHtml(venue)}${escapeHtml(timePart)} — ${escapeHtml(publicText(reason))} ${formatSourceLinkHtml(event)}</li>`;
}

function getWeeklyEvaluatedReason(event: RankedEvent, isHighlighted: boolean): string {
  if (isHighlighted) {
    return "Highlighted above.";
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
  const { highlights, remaining, noStrongMatches } = selectEmailSections(rankedEvents);

  const sections: string[] = [
    "Subject: Live Music Scout — Tonight around Seattle/Bellevue",
    "",
    `Date: ${formatTonightLong(now)}`,
    "",
    "## Tonight’s Highlights",
    highlights.length > 0 ? highlights.map(renderHighlight).join("\n\n") : "No strong highlights tonight."
  ];

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
  const { highlights, remaining } = selectEmailSections(rankedEvents);

  return [
    "<!doctype html>",
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 24px;">',
    `<p><strong>Subject:</strong> Live Music Scout — Tonight around Seattle/Bellevue</p>`,
    `<p><strong>Date:</strong> ${escapeHtml(formatTonightLong(now))}</p>`,
    "<h2>Tonight’s Highlights</h2>",
    highlights.length > 0 ? highlights.map(renderHighlightHtml).join("") : "<p>No strong highlights tonight.</p>",
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
  endKey: string
): string {
  const { highlights, evaluatedByDay, highlightIds } = selectWeeklyEmailSections(rankedEvents);
  const sections: string[] = [
    "Subject: Live Music Scout — This Week around Seattle/Bellevue",
    "",
    `Date range: ${formatDateRangeLong(startKey, endKey)}`,
    "",
    "## This Week’s Highlights",
    highlights.length > 0 ? highlights.map(renderWeeklyHighlight).join("\n\n") : "No strong highlights this week."
  ];

  sections.push("");
  sections.push("## Evaluated Shows by Day");

  if (evaluatedByDay.size === 0) {
    sections.push("No other evaluated shows in this window.");
  } else {
    for (const [dateKey, events] of Array.from(evaluatedByDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      sections.push("");
      sections.push(`### ${formatDateKeyWeekday(dateKey)}`);
      sections.push(events.map((event) => renderWeeklyEvaluatedItem(event, highlightIds.has(event.id))).join("\n"));
    }
  }

  sections.push("");
  sections.push("Evaluated from the configured venue sources; not a complete citywide calendar.");

  return sections.join("\n");
}

export function generateWeeklyEmailHtml(
  now: Date,
  rankedEvents: RankedEvent[],
  startKey: string,
  endKey: string
): string {
  const { highlights, evaluatedByDay, highlightIds } = selectWeeklyEmailSections(rankedEvents);

  return [
    "<!doctype html>",
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 720px; margin: 0 auto; padding: 24px;">',
    "<p><strong>Subject:</strong> Live Music Scout — This Week around Seattle/Bellevue</p>",
    `<p><strong>Date range:</strong> ${escapeHtml(formatDateRangeLong(startKey, endKey))}</p>`,
    "<h2>This Week’s Highlights</h2>",
    highlights.length > 0 ? highlights.map(renderWeeklyHighlightHtml).join("") : "<p>No strong highlights this week.</p>",
    "<h2>Evaluated Shows by Day</h2>",
    evaluatedByDay.size === 0
      ? "<p>No other evaluated shows in this window.</p>"
      : Array.from(evaluatedByDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([dateKey, events]) =>
              `<h3>${escapeHtml(formatDateKeyWeekday(dateKey))}</h3><ul>${events.map((event) => renderWeeklyEvaluatedItemHtml(event, highlightIds.has(event.id))).join("")}</ul>`
          )
          .join(""),
    "<p><em>Evaluated from the configured venue sources; not a complete citywide calendar.</em></p>",
    "</body></html>"
  ].join("");
}
