import test from "node:test";
import assert from "node:assert/strict";

import { extractTripleDoorListings, parseTripleDoor } from "../src/parsers/tripleDoor.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "The Triple Door",
  url: "https://www.thetripledoor.net/mainstage-calendar",
  parser: "tripleDoor",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Downtown"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-01T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

const SAMPLE_HTML = `
<section class="upcoming">
  <section class="promo">New lower prices on drinks & snacks! Cocktails $12.</section>
  <article class="list-style">
    <div class="event-detail" data-event-id="1" data-occurrence-id="101">
      <div class="event-description">
        <div class="event-info-wrapper">
          <h2 class="event-info event-title heading-tertiary"><a href="https://thetripledoor.net/event/1/101/test-artist">Test Artist Trio</a></h2>
          <p class="event-info event-datetime">
            <span class="date">Tuesday, April 28</span> @ <span class="time">7:30PM</span>
          </p>
          <p class="event-info event-location">
            <span>Mainstage Theatre, 216 Union Street, Seattle</span>
          </p>
        </div>
        <div class="event-info event-notes"><p>Jazz trio with deep groove and piano-led arrangements.</p></div>
        <div class="event-info event-price">$32 - $59</div>
        <a href="https://tickets.thetripledoor.net/event/1">Get tickets</a>
      </div>
    </div>
  </article>
  <article class="list-style">
    <div class="event-detail" data-event-id="2" data-occurrence-id="102">
      <div class="event-description">
        <div class="event-info-wrapper">
          <h2 class="event-info event-title heading-tertiary"><a href="https://thetripledoor.net/event/2/102/private-event">Closed for a private event</a></h2>
          <p class="event-info event-datetime">
            <span class="date">Wednesday, April 29</span>
          </p>
          <p class="event-info event-location">
            <span>Mainstage Theatre, 216 Union Street, Seattle</span>
          </p>
        </div>
        <div class="event-info event-notes"><p>Private reception with dinner packages from $75.</p></div>
      </div>
    </div>
  </article>
  <article class="list-style">
    <div class="event-detail" data-event-id="3" data-occurrence-id="103">
      <div class="event-description">
        <div class="event-info-wrapper">
          <h2 class="event-info event-title heading-tertiary"><a href="https://thetripledoor.net/event/3/103/no-price-band">No Price Band</a></h2>
          <p class="event-info event-datetime">
            <span class="date">Thursday, April 30</span> @ <span class="time">8:00PM</span>
          </p>
          <p class="event-info event-location">
            <span>Mainstage Theatre, 216 Union Street, Seattle</span>
          </p>
        </div>
        <div class="event-info event-notes"><p>Soul band with dinner available and drinks from $14.</p></div>
        <a href="https://tickets.thetripledoor.net/event/3">Get tickets</a>
      </div>
    </div>
  </article>
</section>
`;

test("extractTripleDoorListings pulls canonical event page data from upcoming listing blocks", () => {
  const listings = extractTripleDoorListings(SAMPLE_HTML);

  assert.equal(listings.length, 3);
  assert.equal(listings[0].title, "Test Artist Trio");
  assert.equal(listings[0].url, "https://thetripledoor.net/event/1/101/test-artist");
  assert.equal(listings[0].dateText, "Tuesday, April 28");
  assert.equal(listings[0].time, "7:30 PM");
  assert.equal(listings[0].location, "Mainstage Theatre, 216 Union Street, Seattle");
  assert.equal(listings[0].ticketPriceText, "$32 - $59");
  assert.equal(listings[2].ticketPriceText, undefined);
});

test("parseTripleDoor carries source-visible event-block ticket price text to scout events", async () => {
  const result = await parseTripleDoor(SAMPLE_HTML, CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].title, "Test Artist Trio");
  assert.equal(result.events[0].ticketPriceText, "$32 - $59");
  assert.equal(result.events[1].title, "No Price Band");
  assert.equal(result.events[1].ticketPriceText, undefined);
});
