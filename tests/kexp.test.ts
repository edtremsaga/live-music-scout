import test from "node:test";
import assert from "node:assert/strict";

import { extractKexpDetail, extractKexpListings, parseKexp } from "../src/parsers/kexp.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "KEXP Events",
  url: "https://www.kexp.org/events/",
  parser: "kexp",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Lower Queen Anne"],
  sourceType: "promoter",
  musicOnly: true,
  coveredVenues: ["KEXP Studio (NW Rooms)", "Laser Dome at Pacific Science Center"],
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-30T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

const SAMPLE_HTML = `
<div class="ListCard-row">
  <div class="ListCard-column ListCard-column--md">
    <span class="ListCard-value">May 2</span>
  </div>
  <div class="ListCard-column">
    <a href="/events/kexp-events/pushing-boundaries-2026/" class="ListCard-title">Pushing Boundaries</a>
    <a class="ListCard-subtitle" href="https://maps.google.com?q=on-the-air-at-903-fm-seattle-927-fm-san-francisco-worldwide-at-kexporg" target="_blank">
      On the air at 90.3 FM Seattle + 92.7 FM San Francisco // worldwide at KEXP.ORG
    </a>
  </div>
</div>
<hr>
<div class="ListCard-row">
  <div class="ListCard-column ListCard-column--md">
    <span class="ListCard-value">May 3</span>
  </div>
  <div class="ListCard-column">
    <a href="/events/kexp-events/cabaret-voltaire-live-on-kexp-kexp_481761/" class="ListCard-title">Cabaret Voltaire LIVE on KEXP (OPEN TO THE PUBLIC)</a>
    <a class="ListCard-subtitle" href="https://maps.google.com?q=kexp-studio-nw-rooms" target="_blank">
      KEXP Studio (NW Rooms)
    </a>
  </div>
</div>
<hr>
<div class="ListCard-row">
  <div class="ListCard-column ListCard-column--md">
    <span class="ListCard-value">May 6</span>
  </div>
  <div class="ListCard-column">
    <a href="/events/kexp-events/diana-ratsamee-of-eastern-echoes-at-the-laserdome/" class="ListCard-title">Diana Ratsamee of Eastern Echoes at The Laserdome</a>
    <a class="ListCard-subtitle" href="https://maps.google.com?q=laser-dome-at-pacific-science-center-200-sue-bird-court-n-seattle-wa-98109" target="_blank">
      Laser Dome at Pacific Science Center // 200 Sue Bird Court N, Seattle, WA 98109
    </a>
  </div>
</div>
<hr>
<div class="ListCard-row">
  <div class="ListCard-column ListCard-column--md">
    <span class="ListCard-value">May 7</span>
  </div>
  <div class="ListCard-column">
    <a href="/events/bayarea/example/" class="ListCard-title">KEXP Bay Area Showcase</a>
    <a class="ListCard-subtitle" href="https://maps.google.com?q=san-francisco-ca" target="_blank">
      The Chapel // San Francisco, CA
    </a>
  </div>
</div>
`;

const DETAIL_HTML = `
<div class="lead u-h4"><h5>photo by Paul Heartfield</h5></div>
<div class="content"><p>Open to the public in-studio session.</p></div>
<span class="start">
  05/03/2026 15:00
</span>
`;

test("extractKexpListings keeps Seattle public in-person rows and skips broadcast-only/non-Seattle rows", () => {
  const listings = extractKexpListings(SAMPLE_HTML, CONTEXT);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Cabaret Voltaire");
  assert.equal(listings[0].date, "2026-05-03");
  assert.equal(listings[0].venue, "KEXP Studio (NW Rooms)");
  assert.equal(listings[0].location, "KEXP Studio (NW Rooms), Seattle, WA");
  assert.equal(listings[0].url, "https://www.kexp.org/events/kexp-events/cabaret-voltaire-live-on-kexp-kexp_481761/");

  assert.equal(listings[1].title, "Diana Ratsamee of Eastern Echoes at The Laserdome");
  assert.equal(listings[1].venue, "Laser Dome at Pacific Science Center");
  assert.equal(listings[1].location, "200 Sue Bird Court N, Seattle, WA 98109");
});

test("extractKexpDetail reads public calendar start time from detail page HTML", () => {
  const detail = extractKexpDetail(DETAIL_HTML);

  assert.equal(detail.time, "3:00 PM");
  assert.match(detail.description ?? "", /Open to the public/);
});

test("parseKexp fetches public detail pages and normalizes KEXP events", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(DETAIL_HTML, {
      status: 200,
      headers: {
        "content-type": "text/html"
      }
    });
  };

  try {
    const result = await parseKexp(SAMPLE_HTML, CONTEXT);

    assert.equal(result.events.length, 2);
    assert.equal(result.candidateCount, 2);
    assert.equal(result.parserConfidence, "High");
    assert.match(result.statusMessage, /parsed public in-person KEXP event rows/);
    assert.equal(requestedUrls.length, 2);
    assert.equal(result.events[0].title, "Cabaret Voltaire");
    assert.equal(result.events[0].time, "3:00 PM");
    assert.equal(result.events[0].sourceName, "KEXP Events");
    assert.equal(result.events[0].genreHints.includes("KEXP public event"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
