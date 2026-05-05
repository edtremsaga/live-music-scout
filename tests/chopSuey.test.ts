import test from "node:test";
import assert from "node:assert/strict";

import { extractChopSueyListings, parseChopSuey } from "../src/parsers/chopSuey.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

function makeSource(): SourceConfig {
  return {
    name: "Chop Suey",
    url: "https://chopsuey.com/tm-venue/chop-suey/",
    parser: "chopSuey",
    location: "Seattle, WA",
    areaTags: ["Seattle", "Capitol Hill"],
    sourceType: "venue",
    musicOnly: true,
    parserStatus: "live"
  };
}

function makeContext(): ParserContext {
  return {
    source: makeSource(),
    now: new Date("2026-04-30T12:00:00-07:00"),
    timezone: "America/Los_Angeles"
  };
}

const FIXTURE_HTML = `
  <main>
    <article>
      <a href="https://chopsuey.com/tm-event/beautiful-freaks/"><img alt="event-img" src="https://chopsuey.com/uploads/beautiful.jpg"></a>
      <a href="https://chopsuey.com/tm-event/beautiful-freaks/">Beautiful Freaks, Universe, Casino Youth, Fatal Femmes, Nerve Rot</a>
      <p>Thu 04.30</p>
      <p>Doors: 7:00 PM / Show: 7:30 PM</p>
      <a href="https://www.ticketweb.com/event/example">Buy Tickets</a>
    </article>
    <article>
      <a href="/tm-event/house-of-disco-a-night-of-classic-disco-modern-house-anthems/">House of Disco – A Night of Classic Disco &amp; Modern House Anthems</a>
      <p>Sat 05.2</p>
      <p>Show:9:00 PM</p>
      <a href="https://www.ticketweb.com/event/disco">Buy Tickets</a>
    </article>
    <h3>Venue Address:</h3>
  </main>
`;

test("extractChopSueyListings reads public TicketWeb-powered venue rows", () => {
  const listings = extractChopSueyListings(FIXTURE_HTML, makeContext());

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Beautiful Freaks, Universe, Casino Youth, Fatal Femmes, Nerve Rot");
  assert.equal(listings[0].date, "2026-04-30");
  assert.equal(listings[0].time, "7:30 PM");
  assert.equal(listings[0].url, "https://chopsuey.com/tm-event/beautiful-freaks/");
  assert.equal(listings[0].imageUrl, "https://chopsuey.com/uploads/beautiful.jpg");
  assert.equal(listings[1].title, "House of Disco – A Night of Classic Disco & Modern House Anthems");
  assert.equal(listings[1].date, "2026-05-02");
  assert.equal(listings[1].time, "9:00 PM");
  assert.equal(listings[1].url, "https://chopsuey.com/tm-event/house-of-disco-a-night-of-classic-disco-modern-house-anthems/");
});

test("parseChopSuey normalizes listings into scout events", () => {
  const result = parseChopSuey(FIXTURE_HTML, makeContext());

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].venue, "Chop Suey");
  assert.equal(result.events[0].imageUrl, "https://chopsuey.com/uploads/beautiful.jpg");
  assert.equal(result.events[0].imageAlt, "Beautiful Freaks, Universe, Casino Youth, Fatal Femmes, Nerve Rot event image");
  assert.equal(result.events[0].sourceName, "Chop Suey");
  assert.equal(result.events[0].location, "1325 E Madison St, Seattle, WA 98122");
  assert.equal(result.events[1].genreHints.includes("dance party"), false);
  assert.equal(result.events[1].genreHints.includes("disco"), true);
  assert.match(result.statusMessage, /parsed Chop Suey public TicketWeb-powered event rows/);
});

test("parseChopSuey skips past listings", () => {
  const result = parseChopSuey(FIXTURE_HTML, {
    ...makeContext(),
    now: new Date("2026-05-01T12:00:00-07:00")
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "House of Disco – A Night of Classic Disco & Modern House Anthems");
});
