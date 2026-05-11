import test from "node:test";
import assert from "node:assert/strict";

import { extractBakesPlaceListings, parseBakesPlace } from "../src/parsers/bakesPlace.js";

const SAMPLE_HTML = `
<div class="events-holder">
  <section>
    <div class="row event-content">
      <div class="col-md-6 col-sm-6 col-xs-12 event-image-holder">
        <img alt="Martin Ross &amp; The Bake&apos;s Place All-Stars event photo" class="event-image" src="//static.spotapps.co/spots/7f/2cd9847e2d4f8d8306b8c602e7a7ef/w926"/>
      </div>
      <div class="col-md-6 col-sm-6 col-xs-12 event-text-holder">
        <h2>Martin Ross &amp; The Bake&apos;s Place All-Stars</h2>
        <h3>Friday May 1st</h3>
        <div class="event-info-text">
          <div data-event-id="2772352" data-is-recurring="false"></div>
          <p>Essential funk from the '60s, '70s, and '80s with powerhouse vocals and saxophone fire. $25 per person music charge. $30 per person food &amp; beverage minimum.</p>
        </div>
        <h3 class="event-time">08:00 PM - 09:30 PM</h3>
        <span class="addtocalendar atc-style-blue">
          <var class="atc_event">
            <var class="atc_date_start">2026-05-01 20:00:00</var>
            <var class="atc_date_end">2026-05-01 21:30:00</var>
            <var class="atc_title">Martin Ross &amp; The Bake&#039;s Place All-Stars</var>
            <var class="atc_description">Essential funk from the '60s, '70s, and '80s.</var>
            <var class="atc_location">Bake&#039;s Place Bar &amp; Bistro</var>
          </var>
        </span>
      </div>
    </div>
  </section>
</div>
`;

test("extractBakesPlaceListings pulls normalized event data from Bake's Place event blocks", () => {
  const listings = extractBakesPlaceListings(
    SAMPLE_HTML,
    "https://bakesplacebellevue.com/bellevue-bellevue-bake-s-place-bar-and-bistro-live-music"
  );

  assert.equal(listings.length, 1);
  assert.equal(listings[0].eventId, "2772352");
  assert.equal(listings[0].title, "Martin Ross & The Bake's Place All-Stars");
  assert.equal(listings[0].startDateKey, "2026-05-01");
  assert.equal(listings[0].timeText, "08:00 PM - 09:30 PM");
  assert.equal(listings[0].ticketPriceText, "$25 per person music charge; $30 per person food & beverage minimum");
  assert.equal(
    listings[0].url,
    "https://bakesplacebellevue.com/bellevue-bellevue-bake-s-place-bar-and-bistro-live-music"
  );
  assert.equal(
    listings[0].imageUrl,
    "https://static.spotapps.co/spots/7f/2cd9847e2d4f8d8306b8c602e7a7ef/w926"
  );
});

test("parseBakesPlace attaches normalized event image URLs", () => {
  const result = parseBakesPlace(SAMPLE_HTML, {
    now: new Date("2026-05-01T12:00:00-07:00"),
    timezone: "America/Los_Angeles",
    source: {
      name: "Bake's Place",
      url: "https://bakesplacebellevue.com/bellevue-bellevue-bake-s-place-bar-and-bistro-live-music",
      parser: "bakesPlace"
    }
  });

  assert.equal(result.events.length, 1);
  assert.equal(
    result.events[0].imageUrl,
    "https://static.spotapps.co/spots/7f/2cd9847e2d4f8d8306b8c602e7a7ef/w926"
  );
  assert.equal(result.events[0].imageAlt, "Martin Ross & The Bake's Place All-Stars event image");
  assert.equal(result.events[0].ticketPriceText, "$25 per person music charge; $30 per person food & beverage minimum");
});
