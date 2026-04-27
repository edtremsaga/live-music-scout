import test from "node:test";
import assert from "node:assert/strict";

import { extractTripleDoorListings } from "../src/parsers/tripleDoor.js";

const SAMPLE_HTML = `
<section class="upcoming">
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
      </div>
    </div>
  </article>
</section>
`;

test("extractTripleDoorListings pulls canonical event page data from upcoming listing blocks", () => {
  const listings = extractTripleDoorListings(SAMPLE_HTML);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Test Artist Trio");
  assert.equal(listings[0].url, "https://thetripledoor.net/event/1/101/test-artist");
  assert.equal(listings[0].dateText, "Tuesday, April 28");
  assert.equal(listings[0].time, "7:30 PM");
  assert.equal(listings[0].location, "Mainstage Theatre, 216 Union Street, Seattle");
});
