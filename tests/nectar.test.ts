import test from "node:test";
import assert from "node:assert/strict";

import { extractNectarFamilyListings } from "../src/parsers/nectar.js";

const SAMPLE_HTML = `
<div class="sg-events__event" data-group-id="748" data-venue-id="2376">
  <article>
    <time class="sg-events__event-date">
      <span class="sg-events__event-day-of-week">Fri</span>
      <span class="sg-events__event-month">May</span>
      <span class="sg-events__event-day">1</span>
      <span class="sg-events__event-year">2026</span>
    </time>
    <div class="sg-events__event-details">
      <header>
        <div class="sg-events__event-top-bar"><span>LNE presents:</span></div>
        <h3 class="sg-events__event-title">
          <a class="sg-events__event-title-link" href="https://www.tixr.com/groups/nectarlounge/events/test-show-12345" target="_blank">
            TEST HEADLINER with OPENER
          </a>
        </h3>
        <h4 class="sg-events__event-supporting-artists">with TEST OPENER</h4>
        <time class="sg-events__event-start">8:00 PM</time>
        <div class="sg-events__event-venue">
          <div class="sg-events__event-venue-name">Nectar Lounge</div>
          <div class="sg-events__event-venue-location">Seattle, WA</div>
        </div>
      </header>
    </div>
  </article>
</div>
<div class="sg-events__event" data-group-id="900" data-venue-id="9988">
  <article>
    <time class="sg-events__event-date">
      <span class="sg-events__event-day-of-week">Sat</span>
      <span class="sg-events__event-month">May</span>
      <span class="sg-events__event-day">2</span>
      <span class="sg-events__event-year">2026</span>
    </time>
    <div class="sg-events__event-details">
      <header>
        <h3 class="sg-events__event-title">
          <a class="sg-events__event-title-link" href="https://www.tixr.com/groups/hiddenhall/events/test-hidden-hall-12345" target="_blank">
            HIDDEN HALL HEADLINER
          </a>
        </h3>
        <time class="sg-events__event-start">9:30 PM</time>
        <div class="sg-events__event-venue">
          <div class="sg-events__event-venue-name">Hidden Hall</div>
          <div class="sg-events__event-venue-location">Seattle, WA</div>
        </div>
      </header>
    </div>
  </article>
</div>
`;

test("extractNectarFamilyListings pulls normalized shared calendar event data", () => {
  const listings = extractNectarFamilyListings(SAMPLE_HTML);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "TEST HEADLINER with OPENER");
  assert.equal(listings[0].date, "2026-05-01");
  assert.equal(listings[0].time, "8:00 PM");
  assert.equal(listings[0].venueName, "Nectar Lounge");
  assert.equal(listings[0].url, "https://www.tixr.com/groups/nectarlounge/events/test-show-12345");

  assert.equal(listings[1].title, "HIDDEN HALL HEADLINER");
  assert.equal(listings[1].date, "2026-05-02");
  assert.equal(listings[1].time, "9:30 PM");
  assert.equal(listings[1].venueName, "Hidden Hall");
});
