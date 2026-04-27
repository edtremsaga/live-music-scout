import test from "node:test";
import assert from "node:assert/strict";

import { extractStgListings, parseStg } from "../src/parsers/stg.js";
import type { ParserContext } from "../src/types.js";

const BASE_CONTEXT: ParserContext = {
  now: new Date("2026-04-27T19:00:00-07:00"),
  timezone: "America/Los_Angeles",
  source: {
    name: "STG Presents",
    url: "https://www.stgpresents.org/events/",
    parser: "stg"
  }
};

const SAMPLE_HTML = `
  <a href="https://www.stgpresents.org/events/">Events</a>
  <a href="https://www.stgpresents.org/tickets/silent-movie-mondays/">Silent Movie Mondays</a>

  <article class="mec-event-article">
    <div class="mec-event-image">
      <a href="/events/alice-phoebe-lou/"><img src="alice.jpg" /></a>
    </div>
    <div class="mec-event-content">
      <h3 class="mec-event-title">
        <a class="mec-color-hover" href="/events/alice-phoebe-lou/">Alice Phoebe Lou</a>
      </h3>
      <div class="mec-event-description">
        The Neptune Theatre<br>
        Tuesday, Apr. 28, 2026<br>
        8pm<br>
        <a href="https://www.ticketmaster.com/example">Get Tickets</a>
      </div>
    </div>
    <div class="mec-event-meta">
      <span class="mec-start-date-label">Apr 28</span>
      <span class="mec-start-time">8:00 PM</span>
      <div class="mec-venue-details"><span>The Neptune Theatre</span><address class="mec-event-address"><span>1303 Northeast 45th Street, Seattle, WA 98105</span></address></div>
    </div>
    <div class="mec-event-footer">
      <a class="mec-booking-button" href="/events/alice-phoebe-lou/">Tickets &amp; Info</a>
    </div>
  </article>

  <article class="mec-event-article">
    <div class="mec-event-image">
      <a href="/events/silent-movie-mondays-faust/"><img src="faust.jpg" /></a>
    </div>
    <div class="mec-event-content">
      <h3 class="mec-event-title">
        <a class="mec-color-hover" href="/events/silent-movie-mondays-faust/">Silent Movie Mondays &#8211; Faust (1926)</a>
      </h3>
      <div class="mec-event-description">
        The Paramount Theatre<br>
        Monday, Apr. 27, 2026<br>
        7pm<br>
        <a href="https://www.ticketmaster.com/artist/999234">Get Tickets</a>
      </div>
    </div>
    <div class="mec-event-meta">
      <span class="mec-start-date-label">Apr 27</span>
      <span class="mec-start-time">7:00 PM</span>
      <div class="mec-venue-details"><span>The Paramount Theatre</span><address class="mec-event-address"><span>911 Pine St, Seattle, WA 98101</span></address></div>
    </div>
    <div class="mec-event-footer">
      <a class="mec-booking-button" href="/events/silent-movie-mondays-faust/">Tickets &amp; Info</a>
    </div>
  </article>
`;

const MISSING_LINK_HTML = `
  <article class="mec-event-article">
    <div class="mec-event-content">
      <h3 class="mec-event-title">Helloween</h3>
      <div class="mec-event-description">
        The Paramount Theatre<br>
        Tuesday, Apr. 28, 2026<br>
        7:30pm
      </div>
    </div>
    <div class="mec-event-meta">
      <span class="mec-start-date-label">Apr 28</span>
      <span class="mec-start-time">7:30 PM</span>
      <div class="mec-venue-details"><span>The Paramount Theatre</span><address class="mec-event-address"><span>911 Pine St, Seattle, WA 98101</span></address></div>
    </div>
  </article>
`;

test("extractStgListings keeps event URLs scoped to each event card", () => {
  const listings = extractStgListings(SAMPLE_HTML);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Alice Phoebe Lou");
  assert.equal(listings[0].url, "https://www.stgpresents.org/events/alice-phoebe-lou/");
  assert.equal(listings[1].title, "Silent Movie Mondays – Faust (1926)");
  assert.equal(listings[1].url, "https://www.stgpresents.org/events/silent-movie-mondays-faust/");
});

test("parseStg normalizes relative STG event links and ignores generic page-level links", () => {
  const result = parseStg(SAMPLE_HTML, BASE_CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].url, "https://www.stgpresents.org/events/alice-phoebe-lou/");
  assert.equal(result.events[1].url, "https://www.stgpresents.org/events/silent-movie-mondays-faust/");
  assert.notEqual(result.events[1].url, "https://www.stgpresents.org/tickets/silent-movie-mondays/");
  assert.notEqual(result.events[1].url, "https://www.stgpresents.org/events/");
});

test("parseStg does not reuse the previous card URL when the current card lacks a detail link", () => {
  const result = parseStg(`${SAMPLE_HTML}${MISSING_LINK_HTML}`, BASE_CONTEXT);
  const helloween = result.events.find((event) => event.title === "Helloween");

  assert.ok(helloween);
  assert.equal(helloween.url, "https://www.stgpresents.org/events/");
  assert.notEqual(helloween.url, "https://www.stgpresents.org/events/silent-movie-mondays-faust/");
});
