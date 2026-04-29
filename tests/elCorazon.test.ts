import test from "node:test";
import assert from "node:assert/strict";

import { extractElCorazonListings, parseElCorazon } from "../src/parsers/elCorazon.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "El Corazon",
  url: "https://elcorazonseattle.com/",
  parser: "elCorazon",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Eastlake"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-29T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

const SAMPLE_HTML = `
<div role="listitem" class="uui-layout88_item w-dyn-item">
  <div slug="outland-seattle-presents-leather-latex-feat-leaether-strip-30-apr" class="event-div">
    <div><div class="day-date"><div class="text-block-72">Thu</div><div class="text-block-72">Apr 30</div></div></div>
    <a href="/shows/outland-seattle-presents-leather-latex-feat-leaether-strip-30-apr" class="link-block-3 no-underline opendate w-inline-block">
      <div class="event-presenter">Outland Seattle presents</div>
      <div class="event-title w-condition-invisible">Outland Seattle presents: Leather &amp; Latex feat. Leaether Strip</div>
      <div class="headliners">Leæther Strip</div>
    </a>
    <div class="show-details">
      <div class="supporting-talent">Supporting Talent:</div>
      <div class="supports">Torture Gallery, Skull Cultist, Mortal Realm, DJ Sophixi</div>
      <div class="show-times"><div class="text-block-75">Doors at </div><div class="text-block-75">7:00 pm</div><div class="text-block-75">/</div><div class="text-block-75">Show at</div><div class="text-block-75">8:00 pm</div></div>
      <div class="age-restriction"><div class="text-block-77">21+</div></div>
      <div class="venue-location"><div class="text-block-77">AT</div><div class="text-block-77">El Corazón</div><div class="text-block-77 w-condition-invisible">Mammoth NW Presents - El Corazón</div></div>
      <div class="ticket-price"><div class="text-block-77">$33.04 to $72.22</div></div>
    </div>
  </div>
</div>
<div role="listitem" class="uui-layout88_item w-dyn-item">
  <div slug="blvck-hippie-30-apr" class="event-div">
    <div><div class="day-date"><div class="text-block-72">Thu</div><div class="text-block-72">Apr 30</div></div></div>
    <a href="/shows/blvck-hippie-30-apr" class="link-block-3 no-underline opendate w-inline-block">
      <div class="event-presenter w-dyn-bind-empty"></div>
      <div class="event-title w-condition-invisible">Blvck Hippie</div>
      <div class="headliners">Blvck Hippie</div>
    </a>
    <div class="show-details">
      <div class="supporting-talent w-condition-invisible">Supporting Talent:</div>
      <div class="supports w-dyn-bind-empty"></div>
      <div class="show-times"><div class="text-block-75">Doors at </div><div class="text-block-75">7:00 pm</div><div class="text-block-75">/</div><div class="text-block-75">Show at</div><div class="text-block-75">8:00 pm</div></div>
      <div class="age-restriction"><div class="text-block-77">All Ages</div></div>
      <div class="venue-location"><div class="text-block-77">AT</div><div class="text-block-77-copy">The Funhouse</div></div>
      <div class="ticket-price"><div class="text-block-77">$18.61</div></div>
    </div>
  </div>
</div>
`;

test("extractElCorazonListings pulls event cards from public Webflow HTML", () => {
  const listings = extractElCorazonListings(SAMPLE_HTML, CONTEXT);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Outland Seattle presents: Leather & Latex feat. Leaether Strip");
  assert.equal(listings[0].artist, "Leæther Strip");
  assert.equal(listings[0].date, "2026-04-30");
  assert.equal(listings[0].time, "8:00 PM");
  assert.equal(listings[0].venue, "El Corazón");
  assert.equal(
    listings[0].url,
    "https://www.elcorazonseattle.com/shows/outland-seattle-presents-leather-latex-feat-leaether-strip-30-apr"
  );
  assert.match(listings[0].description ?? "", /Torture Gallery/);
  assert.equal(listings[1].venue, "The Funhouse");
});

test("parseElCorazon normalizes public event cards into scout events", () => {
  const result = parseElCorazon(SAMPLE_HTML, CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.equal(result.events[0].sourceName, "El Corazon");
  assert.equal(result.events[0].location, "109 Eastlake Avenue East, Seattle, WA 98109");
  assert.equal(result.events[0].genreHints.includes("live music"), true);
  assert.equal(result.events[0].genreHints.includes("concert"), true);
  assert.equal(result.events[0].genreHints.includes("club venue"), true);
  assert.match(result.statusMessage, /public Webflow event cards/);
});
