import { formatDateKeyShort, formatDateRangeLong, formatTonightLong } from "./dateUtils.js";
import { getEventStatusIssueReason } from "./eventStatus.js";
import { selectEmailSections, selectWeeklyEmailSections, type WeeklyHighlightGroup } from "./generateEmail.js";
import type { RankedEvent, SourceConfig, SourceRunStatus } from "./types.js";
import type { ScoutRunResult } from "./runScout.js";

type VerificationItem = {
  section: string;
  title: string;
  venue: string;
  dates: string[];
  times: string[];
  location?: string;
  url: string;
  sourceName: string;
  verdict: RankedEvent["verdict"];
  score: number;
  classification: RankedEvent["classification"];
  parserConfidence?: string;
  sourceFetchStatus?: string;
  sourceOk?: boolean;
  warnings: string[];
};

type VerificationReportModel = {
  subject: string;
  dateLine: string;
  items: VerificationItem[];
  warningCount: number;
  sourceSummary: string[];
  coverageSummary: string[];
  coverageGapSections: CoverageGapSection[];
  noteLines: string[];
};

type CoverageGap = {
  name: string;
  status: string;
  detail: string;
};

type CoverageGapSection = {
  title: string;
  gaps: CoverageGap[];
};

function publicText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayTitle(event: RankedEvent): string {
  return publicText(event.artist ?? event.title)
    .replace(/\s+\b(BOTH SHOWS|NIGHT ONE|NIGHT TWO|Night 1|Night 2)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map(publicText).filter(Boolean)));
}

function getSourceStatus(statuses: SourceRunStatus[], sourceName: string): SourceRunStatus | undefined {
  return statuses.find((status) => status.sourceName === sourceName);
}

function getEventWarnings(event: RankedEvent, sourceStatus: SourceRunStatus | undefined): string[] {
  const warnings: string[] = [];
  const statusIssue = getEventStatusIssueReason(event);

  if (!event.date) {
    warnings.push("missing date");
  }

  if (!event.time) {
    warnings.push("missing time");
  }

  if (!event.location) {
    warnings.push("missing location");
  }

  if (!event.url) {
    warnings.push("missing source URL");
  }

  if (statusIssue) {
    warnings.push(statusIssue);
  }

  if (!event.classification.isLikelyMusic) {
    warnings.push("classification is not likely music");
  }

  if (sourceStatus?.ok === false || sourceStatus?.fetchStatus === "failed") {
    warnings.push(`source failed: ${sourceStatus.message}`);
  }

  if (sourceStatus?.fetchStatus === "skipped") {
    warnings.push("source was skipped/TODO");
  }

  if (sourceStatus?.parserConfidence === "Low") {
    warnings.push("low parser confidence");
  }

  return warnings;
}

function makeItem(section: string, event: RankedEvent, statuses: SourceRunStatus[]): VerificationItem {
  const sourceStatus = getSourceStatus(statuses, event.sourceName);

  return {
    section,
    title: displayTitle(event),
    venue: publicText(event.venue),
    dates: [event.date].filter(Boolean),
    times: [event.time].filter(Boolean) as string[],
    location: event.location,
    url: event.url,
    sourceName: event.sourceName,
    verdict: event.verdict,
    score: event.score,
    classification: event.classification,
    parserConfidence: sourceStatus?.parserConfidence,
    sourceFetchStatus: sourceStatus?.fetchStatus,
    sourceOk: sourceStatus?.ok,
    warnings: getEventWarnings(event, sourceStatus)
  };
}

function makeGroupItem(section: string, group: WeeklyHighlightGroup, statuses: SourceRunStatus[]): VerificationItem {
  const representative = group.representative;
  const sourceStatus = getSourceStatus(statuses, representative.sourceName);
  const warnings = group.events.flatMap((event) => getEventWarnings(event, getSourceStatus(statuses, event.sourceName)));
  const uniqueWarnings = Array.from(new Set(warnings));

  return {
    section,
    title: displayTitle(representative),
    venue: publicText(representative.venue),
    dates: unique(group.events.map((event) => event.date)).sort(),
    times: unique(group.events.flatMap((event) => (event.time ?? "").split("/"))),
    location: representative.location,
    url: representative.url,
    sourceName: representative.sourceName,
    verdict: representative.verdict,
    score: representative.score,
    classification: representative.classification,
    parserConfidence: sourceStatus?.parserConfidence,
    sourceFetchStatus: sourceStatus?.fetchStatus,
    sourceOk: sourceStatus?.ok,
    warnings: uniqueWarnings
  };
}

function collectVerificationItems(result: ScoutRunResult): VerificationItem[] {
  if (result.reportKind === "week") {
    const { highlights, alsoWorthALook } = selectWeeklyEmailSections(result.rankedEvents);
    return [
      ...highlights.map((group) => makeGroupItem("This Week's Highlights", group, result.statuses)),
      ...alsoWorthALook.map((group) => makeGroupItem("Also Worth a Look", group, result.statuses))
    ];
  }

  const { highlights, alsoWorthChecking } = selectEmailSections(result.rankedEvents);
  return [
    ...highlights.map((event) => makeItem("Tonight's Highlights", event, result.statuses)),
    ...alsoWorthChecking.map((event) => makeItem("Also Worth Checking", event, result.statuses))
  ];
}

function formatDates(dates: string[]): string {
  if (dates.length === 0) {
    return "missing date";
  }

  return dates.map((date) => formatDateKeyShort(date)).join(", ");
}

function formatSourceSummary(statuses: SourceRunStatus[]): string[] {
  const failures = statuses.filter((status) => status.fetchStatus === "failed");
  const skipped = statuses.filter((status) => status.fetchStatus === "skipped");
  const fetchedWithMatches = statuses.filter((status) => status.fetchStatus === "fetched" && status.matchedCount > 0);
  const lines = [
    `Fetched sources with matched events: ${fetchedWithMatches.length}`,
    `Failed sources: ${failures.length}`,
    `Skipped/TODO sources: ${skipped.length}`
  ];

  if (failures.length > 0) {
    lines.push(`Failures: ${failures.map((status) => status.sourceName).join(", ")}`);
    for (const failure of failures.slice(0, 3)) {
      lines.push(`${failure.sourceName}: ${failure.message}`);
    }
  }

  return lines;
}

function summarizeSourceNote(source: SourceConfig): string | undefined {
  const note = source.notes?.replace(/^parser TODO:\s*/i, "");

  if (!note) {
    if (source.name === "Easy Street Records") {
      return "official events page blocks first-pass fetch; needs a better official source or manual-events fallback";
    }

    return undefined;
  }

  if (/CloudFront 403/i.test(note) && /manual-events fallback/i.test(note)) {
    return "official events page blocks first-pass fetch; needs a better official source or manual-events fallback";
  }

  if (/Cloudflare challenge/i.test(note)) {
    return "blocked by Cloudflare";
  }

  if (/old calendar URL currently returns 404/i.test(note)) {
    return "needs a better source URL/feed";
  }

  if (/overlap with STG/i.test(note)) {
    return "needs parser plus STG dedupe";
  }

  if (/sports and non-music/i.test(note)) {
    return "needs music-only filtering";
  }

  if (/outdoor summer music series/i.test(note)) {
    return "seasonal outdoor parser not built yet";
  }

  if (/reliable parser is not implemented yet/i.test(note)) {
    return "reliable parser not implemented yet";
  }

  return note;
}

function formatCoverageStatus(source: SourceConfig, status: SourceRunStatus | undefined): string {
  if (status?.fetchStatus === "failed") {
    return "Failed this run";
  }

  if (source.sourceType === "seasonal_outdoor") {
    return source.parserStatus === "live" && source.parser !== "configuredTodo"
      ? "Live seasonal source outside report window"
      : "Seasonal TODO";
  }

  if (source.sourceType === "large_venue") {
    return source.parserStatus === "live" && source.parser !== "configuredTodo"
      ? "Live large venue source outside report window"
      : "Large venue TODO";
  }

  if (source.parserStatus === "todo" || source.parser === "configuredTodo") {
    return "Not feeding emails";
  }

  return status?.fetchStatus ?? "Not feeding emails";
}

function formatCoverageDetail(source: SourceConfig, status: SourceRunStatus | undefined): string {
  const pieces: string[] = [];

  if (status?.fetchStatus === "skipped") {
    pieces.push("tracked, not parsed yet");
  } else if (status?.fetchStatus === "failed") {
    pieces.push("fetch/parse failed this run");
  } else if (status) {
    pieces.push(`fetched, ${status.candidateCount} parsed, ${status.matchedCount} ${status.matchedLabel}`);
  }

  if (source.seasonal) {
    pieces.push("seasonal");
  }

  const noteSummary = summarizeSourceNote(source);
  if (noteSummary) {
    pieces.push(noteSummary);
  }

  return pieces.length > 0 ? pieces.join("; ") : "configured source is not currently feeding email events";
}

function makeCoverageGap(source: SourceConfig, status: SourceRunStatus | undefined): CoverageGap {
  return {
    name: source.name,
    status: formatCoverageStatus(source, status),
    detail: formatCoverageDetail(source, status)
  };
}

function buildCoverageGapSections(result: ScoutRunResult): CoverageGapSection[] {
  const sources = result.sources ?? [];
  const trackedButNotFeeding = sources
    .filter(
      (source) =>
        source.sourceType === "venue"
        && (source.parserStatus === "todo" || source.parser === "configuredTodo")
    )
    .map((source) => makeCoverageGap(source, getSourceStatus(result.statuses, source.name)));
  const seasonalOutdoor = sources
    .filter(
      (source) =>
        source.sourceType === "seasonal_outdoor"
        && (source.parserStatus === "todo" || source.parser === "configuredTodo")
    )
    .map((source) => makeCoverageGap(source, getSourceStatus(result.statuses, source.name)));
  const liveSeasonalOutsideWindow = sources
    .filter((source) => {
      const status = getSourceStatus(result.statuses, source.name);
      return source.sourceType === "seasonal_outdoor"
        && source.parserStatus === "live"
        && source.parser !== "configuredTodo"
        && status?.fetchStatus === "fetched"
        && status.candidateCount > 0
        && status.matchedCount === 0;
    })
    .map((source) => makeCoverageGap(source, getSourceStatus(result.statuses, source.name)));
  const largeVenue = sources
    .filter(
      (source) =>
        source.sourceType === "large_venue"
        && (source.parserStatus === "todo" || source.parser === "configuredTodo")
    )
    .map((source) => makeCoverageGap(source, getSourceStatus(result.statuses, source.name)));
  const liveLargeVenueOutsideWindow = sources
    .filter((source) => {
      const status = getSourceStatus(result.statuses, source.name);
      return source.sourceType === "large_venue"
        && source.parserStatus === "live"
        && source.parser !== "configuredTodo"
        && status?.fetchStatus === "fetched"
        && status.candidateCount > 0
        && status.matchedCount === 0;
    })
    .map((source) => makeCoverageGap(source, getSourceStatus(result.statuses, source.name)));
  const promoterCaveats = sources
    .filter((source) => source.sourceType === "promoter" && source.coveredVenues && source.coveredVenues.length > 0)
    .map((source) => ({
      name: source.name,
      status: getSourceStatus(result.statuses, source.name)?.fetchStatus ?? "not run",
      detail: `feeds covered venues: ${source.coveredVenues?.join(", ")}`
    }));

  return [
    { title: "Tracked but not feeding emails", gaps: trackedButNotFeeding },
    { title: "Live seasonal sources outside report window", gaps: liveSeasonalOutsideWindow },
    { title: "Seasonal / future parser sources", gaps: seasonalOutdoor },
    { title: "Live large venue sources outside report window", gaps: liveLargeVenueOutsideWindow },
    { title: "Large venue gaps", gaps: largeVenue },
    { title: "Promoter coverage caveats", gaps: promoterCaveats }
  ].filter((section) => section.gaps.length > 0);
}

function formatCoverageSummary(result: ScoutRunResult, coverageGapSections: CoverageGapSection[]): string[] {
  const getGapCount = (title: string): number =>
    coverageGapSections.find((section) => section.title === title)?.gaps.length ?? 0;
  const liveFeedingCount = result.statuses.filter((status) => status.fetchStatus === "fetched" && status.matchedCount > 0).length;

  return [
    `Live parsed sources feeding emails: ${liveFeedingCount}`,
    `Tracked venue sources not feeding emails: ${getGapCount("Tracked but not feeding emails")}`,
    `Live seasonal sources outside report window: ${getGapCount("Live seasonal sources outside report window")}`,
    `Seasonal/future parser sources: ${getGapCount("Seasonal / future parser sources")}`,
    `Live large venue sources outside report window: ${getGapCount("Live large venue sources outside report window")}`,
    `Large venue gaps: ${getGapCount("Large venue gaps")}`
  ];
}

function getVerificationSubject(result: ScoutRunResult): string {
  return result.reportKind === "week"
    ? "Live Music Scout Verification — This Week around Seattle/Bellevue"
    : "Live Music Scout Verification — Tonight around Seattle/Bellevue";
}

function buildVerificationReportModel(result: ScoutRunResult): VerificationReportModel {
  const items = collectVerificationItems(result);
  const warningCount = items.reduce((count, item) => count + item.warnings.length, 0);
  const coverageGapSections = buildCoverageGapSections(result);
  const dateLine = result.reportKind === "week"
    ? `Date range: ${formatDateRangeLong(result.startKey, result.endKey)}`
    : `Date: ${formatTonightLong(result.generatedAt)}`;

  return {
    subject: getVerificationSubject(result),
    dateLine,
    items,
    warningCount,
    sourceSummary: formatSourceSummary(result.statuses),
    coverageSummary: formatCoverageSummary(result, coverageGapSections),
    coverageGapSections,
    noteLines: [
      "This verifies pipeline consistency, required fields, parser/source health, and status-warning signals.",
      "It does not re-fetch every individual event detail page; use the Source links for final human spot-checks before sending."
    ]
  };
}

export function generatePreSendVerificationReport(result: ScoutRunResult): string {
  const report = buildVerificationReportModel(result);
  const lines = [
    `Subject: ${report.subject}`,
    "",
    report.dateLine,
    "",
    "## Summary",
    `- Top-section items: ${report.items.length}`,
    `- Warnings: ${report.warningCount}`,
    ...report.coverageSummary.map((line) => `- ${line}`),
    "",
    "## Source Health",
    ...report.sourceSummary.map((line) => `- ${line}`),
    "",
    "## Coverage Gaps"
  ];

  if (report.coverageGapSections.length === 0) {
    lines.push("- No configured coverage gaps found.");
  } else {
    for (const section of report.coverageGapSections) {
      lines.push("");
      lines.push(`### ${section.title}`);
      for (const gap of section.gaps) {
        lines.push(`- ${gap.name} — ${gap.status} — ${gap.detail}`);
      }
    }
  }

  lines.push("");
  lines.push(
    "## Item Checks"
  );

  let currentSection = "";
  for (const item of report.items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      lines.push("");
      lines.push(`## ${currentSection}`);
    }

    const status = item.warnings.length === 0 ? "OK" : "CHECK";
    const timeText = item.times.length > 0 ? item.times.join(" / ") : "missing time";
    const sourceText = item.sourceFetchStatus
      ? `${item.sourceName} ${item.sourceFetchStatus}${item.parserConfidence ? `, ${item.parserConfidence} confidence` : ""}`
      : item.sourceName;
    const tierNote = item.section.includes("Highlights")
      ? "Top curated section."
      : "Secondary curation section; top picks are capped and lightly diversified.";

    lines.push(`### ${item.title}`);
    lines.push(`- Status: ${status}`);
    lines.push(`- Tier note: ${tierNote}`);
    lines.push(`- Venue: ${item.venue}`);
    lines.push(`- Date${item.dates.length === 1 ? "" : "s"}: ${formatDates(item.dates)}`);
    lines.push(`- Time${item.times.length === 1 ? "" : "s"}: ${timeText}`);
    lines.push(`- Source health: ${sourceText}`);
    lines.push(`- Classification: ${item.classification.eventType}, ${item.classification.musicConfidence} confidence`);
    lines.push(`- Recommendation: ${item.verdict}`);
    lines.push(`- Internal score: ${item.score}`);
    lines.push(`- Link: ${item.url}`);

    if (item.warnings.length > 0) {
      lines.push(`  Warnings: ${item.warnings.join("; ")}`);
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push(...report.noteLines.map((line) => `- ${line}`));

  return lines.join("\n");
}

export function generatePreSendVerificationHtml(result: ScoutRunResult): string {
  const report = buildVerificationReportModel(result);
  const itemSections = new Map<string, VerificationItem[]>();

  for (const item of report.items) {
    itemSections.set(item.section, [...(itemSections.get(item.section) ?? []), item]);
  }

  const renderItem = (item: VerificationItem): string => {
    const status = item.warnings.length === 0 ? "OK" : "CHECK";
    const timeText = item.times.length > 0 ? item.times.join(" / ") : "missing time";
    const sourceText = item.sourceFetchStatus
      ? `${item.sourceName} ${item.sourceFetchStatus}${item.parserConfidence ? `, ${item.parserConfidence} confidence` : ""}`
      : item.sourceName;
    const tierNote = item.section.includes("Highlights")
      ? "Top curated section."
      : "Secondary curation section; top picks are capped and lightly diversified.";

    return [
      `<h3>${escapeHtml(item.title)}</h3>`,
      "<ul>",
      `<li><strong>Status:</strong> ${escapeHtml(status)}</li>`,
      `<li><strong>Tier note:</strong> ${escapeHtml(tierNote)}</li>`,
      `<li><strong>Venue:</strong> ${escapeHtml(item.venue)}</li>`,
      `<li><strong>Date${item.dates.length === 1 ? "" : "s"}:</strong> ${escapeHtml(formatDates(item.dates))}</li>`,
      `<li><strong>Time${item.times.length === 1 ? "" : "s"}:</strong> ${escapeHtml(timeText)}</li>`,
      `<li><strong>Source health:</strong> ${escapeHtml(sourceText)}</li>`,
      `<li><strong>Classification:</strong> ${escapeHtml(`${item.classification.eventType}, ${item.classification.musicConfidence} confidence`)}</li>`,
      `<li><strong>Recommendation:</strong> ${escapeHtml(item.verdict)}</li>`,
      `<li><strong>Internal score:</strong> ${item.score}</li>`,
      `<li><strong>Link:</strong> <a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a></li>`,
      item.warnings.length > 0
        ? `<li><strong>Warnings:</strong> ${escapeHtml(item.warnings.join("; "))}</li>`
        : "",
      "</ul>"
    ].join("");
  };

  return [
    "<!doctype html>",
    '<html><body style="font-family: Arial, sans-serif; line-height: 1.5; color: #222; max-width: 760px; margin: 0 auto; padding: 24px;">',
    `<p><strong>Subject:</strong> ${escapeHtml(report.subject)}</p>`,
    `<p><strong>${escapeHtml(report.dateLine)}</strong></p>`,
    "<h2>Summary</h2>",
    "<ul>",
    `<li><strong>Top-section items:</strong> ${report.items.length}</li>`,
    `<li><strong>Warnings:</strong> ${report.warningCount}</li>`,
    report.coverageSummary.map((line) => `<li>${escapeHtml(line)}</li>`).join(""),
    "</ul>",
    "<h2>Source Health</h2>",
    `<ul>${report.sourceSummary.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
    "<h2>Coverage Gaps</h2>",
    report.coverageGapSections.length === 0
      ? "<p>No configured coverage gaps found.</p>"
      : report.coverageGapSections
          .map(
            (section) =>
              `<h3>${escapeHtml(section.title)}</h3><ul>${section.gaps.map((gap) => `<li><strong>${escapeHtml(gap.name)}:</strong> ${escapeHtml(gap.status)} — ${escapeHtml(gap.detail)}</li>`).join("")}</ul>`
          )
          .join(""),
    "<h2>Item Checks</h2>",
    Array.from(itemSections.entries())
      .map(([section, items]) => `<h2>${escapeHtml(section)}</h2>${items.map(renderItem).join("")}`)
      .join(""),
    "<h2>Notes</h2>",
    `<ul>${report.noteLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`,
    "</body></html>"
  ].join("");
}

export function generatePreSendVerificationEmail(result: ScoutRunResult): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: getVerificationSubject(result),
    text: generatePreSendVerificationReport(result),
    html: generatePreSendVerificationHtml(result)
  };
}
