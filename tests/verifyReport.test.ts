import test from "node:test";
import assert from "node:assert/strict";

import { generatePreSendVerificationEmail } from "../src/verifyReport.js";
import type { ScoutRunResult } from "../src/runScout.js";
import type { RankedEvent } from "../src/types.js";

function makeRankedEvent(overrides: Partial<RankedEvent> = {}): RankedEvent {
  return {
    id: "sample-trio",
    title: "Sample Trio",
    artist: "Sample Trio",
    venue: "The Royal Room",
    date: "2026-04-29",
    time: "7:30 PM",
    location: "5000 Rainier Avenue S, Seattle, WA 98118",
    url: "https://example.com/sample-trio",
    sourceName: "The Royal Room",
    genreHints: [],
    confidence: "High",
    basis: "fixture basis",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    },
    score: 12,
    verdict: "Go",
    matchReasons: ["fixture"],
    isSeen: false,
    ...overrides
  };
}

function makeScoutRunResult(overrides: Partial<ScoutRunResult> = {}): ScoutRunResult {
  const rankedEvents = [makeRankedEvent()];

  return {
    generatedAt: new Date("2026-04-29T12:00:00-07:00"),
    reportKind: "tonight",
    subject: "Live Music Scout — Tonight around Seattle/Bellevue",
    preview: "",
    html: "",
    rankedEvents,
    sources: [
      {
        name: "The Royal Room",
        url: "https://theroyalroomseattle.com/events/",
        parser: "royalRoom",
        sourceType: "venue",
        musicOnly: true,
        parserStatus: "live"
      },
      {
        name: "Slim's Last Chance",
        url: "https://www.slimslastchance.com/shows",
        parser: "configuredTodo",
        sourceType: "venue",
        musicOnly: true,
        parserStatus: "todo",
        notes: "parser TODO: Slim's Last Chance is configured as a year-round Georgetown live-music club source, but a reliable parser is not implemented yet"
      },
      {
        name: "Marymoor Park Concerts",
        url: "https://www.marymoorlive.com/",
        parser: "configuredTodo",
        sourceType: "seasonal_outdoor",
        musicOnly: true,
        seasonal: true,
        parserStatus: "todo",
        notes: "parser TODO: Marymoor Park Concerts is configured as an outdoor summer music series source, but a reliable parser is not implemented yet"
      },
      {
        name: "Climate Pledge Arena",
        url: "https://climatepledgearena.com/",
        parser: "configuredTodo",
        sourceType: "large_venue",
        musicOnly: true,
        parserStatus: "todo",
        notes: "parser TODO: Climate Pledge Arena is configured as a music-only large venue source; sports and non-music arena events should be excluded if a parser is added"
      },
      {
        name: "STG Presents",
        url: "https://www.stgpresents.org/events",
        parser: "stg",
        sourceType: "promoter",
        musicOnly: true,
        coveredVenues: ["The Paramount Theatre", "The Neptune Theatre"],
        parserStatus: "live"
      }
    ],
    statuses: [
      {
        sourceName: "The Royal Room",
        parserName: "royalRoom",
        ok: true,
        fetchStatus: "fetched",
        message: "fixture",
        candidateCount: 1,
        matchedCount: 1,
        matchedLabel: "tonight",
        parserConfidence: "High"
      },
      {
        sourceName: "Slim's Last Chance",
        parserName: "configuredTodo",
        ok: true,
        fetchStatus: "skipped",
        message: "parser TODO",
        candidateCount: 0,
        matchedCount: 0,
        matchedLabel: "tonight"
      },
      {
        sourceName: "Marymoor Park Concerts",
        parserName: "configuredTodo",
        ok: true,
        fetchStatus: "skipped",
        message: "parser TODO",
        candidateCount: 0,
        matchedCount: 0,
        matchedLabel: "tonight"
      },
      {
        sourceName: "Climate Pledge Arena",
        parserName: "configuredTodo",
        ok: true,
        fetchStatus: "skipped",
        message: "parser TODO",
        candidateCount: 0,
        matchedCount: 0,
        matchedLabel: "tonight"
      },
      {
        sourceName: "STG Presents",
        parserName: "stg",
        ok: true,
        fetchStatus: "fetched",
        message: "fixture",
        candidateCount: 1,
        matchedCount: 0,
        matchedLabel: "tonight",
        parserConfidence: "Medium"
      }
    ],
    finalEmailItemCount: rankedEvents.length,
    startKey: "2026-04-29",
    endKey: "2026-04-29",
    ...overrides
  };
}

test("verification email uses readable email-style text sections", () => {
  const report = generatePreSendVerificationEmail(makeScoutRunResult());

  assert.equal(report.subject, "Live Music Scout Verification — Tonight around Seattle/Bellevue");
  assert.match(report.text, /## Summary/);
  assert.match(report.text, /## Source Health/);
  assert.match(report.text, /## Coverage Gaps/);
  assert.match(report.text, /## Tonight's Highlights/);
  assert.match(report.text, /### Sample Trio/);
  assert.match(report.text, /- Status: OK/);
  assert.match(report.text, /- Live parsed sources feeding emails: 1/);
  assert.match(report.text, /- Tracked venue sources not feeding emails: 1/);
  assert.match(report.text, /- Tier note: Top curated section\./);
  assert.match(report.text, /- Source health: The Royal Room fetched, High confidence/);
  assert.match(report.text, /- Recommendation: Go/);
  assert.match(report.text, /- Internal score: 12/);
});

test("verification email includes matching html report", () => {
  const report = generatePreSendVerificationEmail(makeScoutRunResult());

  assert.match(report.html, /<h2>Summary<\/h2>/);
  assert.match(report.html, /<h2>Source Health<\/h2>/);
  assert.match(report.html, /<h2>Coverage Gaps<\/h2>/);
  assert.match(report.html, /<h2>Tonight&#39;s Highlights<\/h2>/);
  assert.match(report.html, /<h3>Sample Trio<\/h3>/);
  assert.match(report.html, /<strong>Status:<\/strong> OK/);
  assert.match(report.html, /<strong>Tier note:<\/strong> Top curated section\./);
  assert.match(report.html, /<strong>Recommendation:<\/strong> Go/);
});

test("verification email reports tracked sources that are not feeding emails", () => {
  const report = generatePreSendVerificationEmail(makeScoutRunResult());

  assert.match(report.text, /### Tracked but not feeding emails/);
  assert.match(report.text, /Slim's Last Chance — Not feeding emails — tracked, not parsed yet; reliable parser not implemented yet/);
  assert.match(report.text, /### Seasonal \/ future parser sources/);
  assert.match(report.text, /Marymoor Park Concerts — Seasonal TODO — tracked, not parsed yet; seasonal; seasonal outdoor parser not built yet/);
  assert.match(report.text, /### Large venue gaps/);
  assert.match(report.text, /Climate Pledge Arena — Large venue TODO — tracked, not parsed yet; needs music-only filtering/);
  assert.match(report.text, /### Promoter coverage caveats/);
  assert.match(report.text, /STG Presents — fetched — feeds covered venues: The Paramount Theatre, The Neptune Theatre/);
  assert.match(report.html, /<h3>Tracked but not feeding emails<\/h3>/);
  assert.match(report.html, /<strong>Slim&#39;s Last Chance:<\/strong> Not feeding emails/);
});
