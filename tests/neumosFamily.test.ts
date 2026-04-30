import test from "node:test";
import assert from "node:assert/strict";

import { extractNeumosFamilyListings, parseNeumosFamily } from "../src/parsers/neumosFamily.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

function makeSource(overrides: Partial<SourceConfig>): SourceConfig {
  return {
    name: "Neumos",
    url: "https://www.neumos.com/events/",
    parser: "neumos",
    location: "Seattle, WA",
    areaTags: ["Seattle", "Capitol Hill"],
    sourceType: "venue",
    musicOnly: true,
    parserStatus: "live",
    ...overrides
  };
}

function makeContext(source: SourceConfig): ParserContext {
  return {
    source,
    now: new Date("2026-04-30T12:00:00-07:00"),
    timezone: "America/Los_Angeles"
  };
}

const FIXTURE_HTML = `
  <div class="eventItem entry clearfix">
    <div class="info clearfix">
      <div class="promotion-text">Neumos Presents</div>
      <h3 class="title title-withTagline title-withTour">
        <a href="https://www.neumos.com/events/detail/grace-ives-tickets-1341247" title="More Info">Grace Ives</a>
      </h3>
      <h4 class="tagline">dance arts center</h4>
      <div class="promotion-text tour">Girlfriend Tour</div>
      <div class="date neumos" aria-label="May  1 2026">
        <span class="m-date__singleDate"><span class="m-date__month">May </span><span class="m-date__day"> 1</span></span>
      </div>
      <div class="meta">
        <div class="time">Doors: 5:00 PM</div>
        <div class="age">All Ages to Enter, 21 &amp; Over to Drink</div>
      </div>
    </div>
    <div class="buttons">
      <a href="https://www.axs.com/events/1341247/grace-ives-tickets?skin=neumos" target="_blank" class="tickets onsalenow" data-canceled="false">Buy Tickets</a>
    </div>
  </div>
  <div class="eventItem entry alt clearfix">
    <div class="info clearfix">
      <div class="promotion-text">Neumos Presents</div>
      <h3 class="title"><a href="/events/detail/cut-worms-tickets-1289203" title="More Info">Cut Worms</a></h3>
      <h4 class="tagline">Angela Autumn</h4>
      <div class="date neumos" aria-label="May  2 2026"></div>
      <div class="meta"><div class="time">Doors: 8:00 PM</div><div class="age">21 &amp; Over</div></div>
    </div>
  </div>
`;

const BARBOZA_FIXTURE_HTML = `
  <div class="eventItem entry clearfix">
    <div class="info clearfix">
      <div class="promotion-text">Barboza Presents</div>
      <h3 class="title title-withTagline">
        <a href="https://www.thebarboza.com/events/detail/daniel-romanos-outfit-tickets-1352175" title="More Info">Daniel Romano's Outfit</a>
      </h3>
      <h4 class="tagline">Uni Boys</h4>
      <div class="date barboza" aria-label="May  1 2026"></div>
      <div class="meta">
        <div class="time">Doors: 6:30 PM</div>
        <div class="age">21 &amp; Over</div>
        <div class="venue">Barboza</div>
      </div>
    </div>
  </div>
  <div class="eventItem entry alt clearfix">
    <div class="info clearfix">
      <div class="promotion-text">No Clean Singing Presents</div>
      <h3 class="title"><a href="https://www.thebarboza.com/events/detail/northwest-terror-fest-viii-tickets-1225626">Northwest Terror Fest VIII</a></h3>
      <div class="date barboza" aria-label="May  7 2026"></div>
      <div class="meta">
        <div class="time">Doors: 4:00 PM</div>
        <div class="age">21 &amp; Over</div>
        <div class="venue-name">Neumos</div>
      </div>
    </div>
  </div>
`;

test("extractNeumosFamilyListings reads Neumos public Carbonhouse rows", () => {
  const listings = extractNeumosFamilyListings(FIXTURE_HTML, makeContext(makeSource({})));

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Grace Ives");
  assert.equal(listings[0].date, "2026-05-01");
  assert.equal(listings[0].time, "5:00 PM");
  assert.equal(listings[0].venue, "Neumos");
  assert.equal(listings[1].url, "https://www.neumos.com/events/detail/cut-worms-tickets-1289203");
});

test("parseNeumosFamily normalizes Neumos listings into scout events", () => {
  const result = parseNeumosFamily(FIXTURE_HTML, makeContext(makeSource({})));

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].venue, "Neumos");
  assert.equal(result.events[0].sourceName, "Neumos");
  assert.equal(result.events[0].location, "925 East Pike Street, Seattle, WA 98122");
  assert.equal(result.events[0].genreHints.includes("Capitol Hill club"), true);
  assert.match(result.statusMessage, /parsed Neumos public Carbonhouse event rows/);
});

test("Barboza parser keeps Barboza rows and skips cross-listed Neumos rows", () => {
  const source = makeSource({
    name: "Barboza",
    url: "https://www.thebarboza.com/events",
    parser: "barboza"
  });
  const result = parseNeumosFamily(BARBOZA_FIXTURE_HTML, makeContext(source));

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "Daniel Romano's Outfit");
  assert.equal(result.events[0].venue, "Barboza");
  assert.equal(result.events[0].sourceName, "Barboza");
  assert.equal(result.events[0].time, "6:30 PM");
});
