import { cleanDisplayText, formatTonightLong, getTimeOfDayNote } from "./dateUtils.js";
import type { RankedEvent } from "./types.js";

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
    return titleLower.includes("trio") || titleLower.includes("jammah") || titleLower.includes("jam")
      ? "A likely groove/jam-oriented Royal Room show in a comfortable room with strong local-musician energy."
      : "A Royal Room date that looks promising if you want a comfortable room and musicianship-first energy.";
  }

  if (event.sourceName === "STG Presents") {
    return event.classification.musicConfidence === "High"
      ? "A bigger-room concert option. Worth a look if the artist already appeals to you."
      : "A bigger-room concert option. Worth checking only if the artist already appeals to you.";
  }

  return "Looks like a plausible live-music option for tonight, but probably worth a quick spot-check before heading out.";
}

function buildSkipReason(event: RankedEvent): string {
  if (!event.classification.isLikelyMusic) {
    if (event.classification.eventType === "talk" || event.classification.eventType === "comedy") {
      return "appears to be comedy/talk rather than live music";
    }

    if (event.classification.eventType === "theater" || event.classification.eventType === "dance") {
      return "probably not a live-music fit";
    }

    return "probably not a live-music fit";
  }

  if (event.sourceName === "STG Presents") {
    return "likely music, but not a strong fit for this scout";
  }

  return "not as strong as the better options tonight";
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
    event.verdict === "Maybe"
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
    event.verdict === "Maybe"
      ? "Highlight-worthy, but a lighter fit than the top picks."
      : event.verdict === "Go"
        ? "Strong fit, but already covered in the highlights."
        : `Not highlighted: ${buildSkipReason(event)}.`;

  return `<li>${escapeHtml(title)} — ${escapeHtml(venue)}${escapeHtml(timePart)} — ${escapeHtml(publicText(reason))} ${formatSourceLinkHtml(event)}</li>`;
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
