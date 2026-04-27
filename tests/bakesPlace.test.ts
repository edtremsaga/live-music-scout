import test from "node:test";
import assert from "node:assert/strict";

import { extractBakesPlaceListings } from "../src/parsers/bakesPlace.js";

const SAMPLE_HTML = `
<div class="events-holder">
  <section>
    <div class="row event-content">
      <div class="col-md-6 col-sm-6 col-xs-12 event-text-holder">
        <h2>Martin Ross &amp; The Bake&apos;s Place All-Stars</h2>
        <h3>Friday May 1st</h3>
        <div class="event-info-text">
          <div data-event-id="2772352" data-is-recurring="false"></div>
          <p>Essential funk from the '60s, '70s, and '80s with powerhouse vocals and saxophone fire.</p>
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
  assert.equal(
    listings[0].url,
    "https://bakesplacebellevue.com/bellevue-bellevue-bake-s-place-bar-and-bistro-live-music"
  );
});
