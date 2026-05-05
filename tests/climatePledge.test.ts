import test from "node:test";
import assert from "node:assert/strict";

import {
  extractClimatePledgeJsonLdEvents,
  normalizeClimatePledgeEvent,
  parseClimatePledge
} from "../src/parsers/climatePledge.js";
import type { LiveMusicEvent, ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "Climate Pledge Arena",
  url: "https://www.ticketmaster.com/climate-pledge-arena-tickets-seattle/venue/123894",
  parser: "climatePledge",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Uptown"],
  sourceType: "large_venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-30T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

const SAMPLE_HTML = `
<html>
  <body>
    <script type="application/ld+json">
      [
        {
          "@context": "https://schema.org",
          "@type": "MusicEvent",
          "name": "Florence + The Machine",
          "description": "Everybody Scream Tour",
          "image": "https://s1.ticketm.net/florence.jpg",
          "startDate": "2026-05-12T19:30:00",
          "url": "https://www.ticketmaster.com/florence-the-machine-seattle-washington-05-12-2026/event/0F0062E2",
          "location": { "name": "Climate Pledge Arena" }
        },
        {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": "Seattle Storm vs. Indiana Fever",
          "description": "WNBA game",
          "startDate": "2026-06-01T19:00:00",
          "url": "https://www.ticketmaster.com/seattle-storm/event/0F00SPORT",
          "location": { "name": "Climate Pledge Arena" }
        },
        {
          "@context": "https://schema.org",
          "@type": "TheaterEvent",
          "name": "Zakir Khan",
          "description": "Comedy and spoken-word event",
          "startDate": "2026-06-05T20:00:00",
          "url": "https://www.ticketmaster.com/zakir-khan/event/0F00THEATER",
          "location": { "name": "Climate Pledge Arena" }
        },
        {
          "@context": "https://schema.org",
          "@type": "MusicEvent",
          "name": "Florence + The Machine VIP Upgrade Pass",
          "description": "Event ticket sold separately",
          "startDate": "2026-05-12T19:30:00",
          "url": "https://www.ticketmaster.com/florence-vip-upgrade-pass/event/0F00PASS",
          "location": { "name": "Climate Pledge Arena" }
        },
        {
          "@context": "https://schema.org",
          "@type": "MusicEvent",
          "name": "Passion Pit",
          "description": "North American Tour",
          "startDate": "2026-07-10T20:00:00",
          "url": "https://www.ticketmaster.com/passion-pit-seattle-washington-07-10-2026/event/0F00MUSIC",
          "location": { "name": "Climate Pledge Arena" }
        },
        {
          "@context": "https://schema.org",
          "@type": "MusicEvent",
          "name": "Demi Lovato",
          "description": "It's Not That Deep Tour",
          "startDate": "2026-05-13T20:00:00",
          "url": "https://www.ticketmaster.com/demi-lovato-portland/event/0F00PORTLAND",
          "location": { "name": "Moda Center" }
        }
      ]
    </script>
  </body>
</html>
`;

test("extractClimatePledgeJsonLdEvents reads Ticketmaster JSON-LD arrays", () => {
  const events = extractClimatePledgeJsonLdEvents(SAMPLE_HTML);

  assert.equal(events.length, 6);
  assert.equal(events[0].name, "Florence + The Machine");
  assert.equal(events[0]["@type"], "MusicEvent");
});

test("normalizeClimatePledgeEvent accepts only Climate Pledge MusicEvent entries", () => {
  const events = extractClimatePledgeJsonLdEvents(SAMPLE_HTML);
  const normalized = events
    .map((event) => normalizeClimatePledgeEvent(event, CONTEXT))
    .filter((event): event is LiveMusicEvent => Boolean(event));

  assert.deepEqual(normalized.map((event) => event.title), [
    "Florence + The Machine",
    "Passion Pit"
  ]);
  const first = normalized[0];

  assert.ok(first);
  assert.equal(first.venue, "Climate Pledge Arena");
  assert.equal(first.date, "2026-05-12");
  assert.equal(first.time, "7:30 PM");
  assert.equal(first.location, "334 1st Ave N, Seattle, WA 98109");
  assert.equal(first.sourceName, "Climate Pledge Arena");
  assert.equal(first.imageUrl, "https://s1.ticketm.net/florence.jpg");
  assert.equal(first.imageAlt, "Florence + The Machine event image");
  assert.equal(first.confidence, "High");
  assert.equal(first.genreHints.includes("large arena concert"), true);
  assert.equal(first.genreHints.includes("Ticketmaster MusicEvent"), true);
  assert.match(first.basis, /sports, comedy\/theater, add-ons, passes, suites, parking, and arena tours are excluded/);
});

test("parseClimatePledge filters sports, theater, add-ons, and non-Climate Pledge rows", () => {
  const result = parseClimatePledge(SAMPLE_HTML, CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.deepEqual(result.events.map((event) => event.title), [
    "Florence + The Machine",
    "Passion Pit"
  ]);
  assert.match(result.statusMessage, /parsed Climate Pledge Arena music events from Ticketmaster public JSON-LD/);
});
