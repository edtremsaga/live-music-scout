import test from "node:test";
import assert from "node:assert/strict";

import { extractMarymoorListings, parseMarymoor } from "../src/parsers/marymoor.js";

const SAMPLE_HTML = `
<div class="tw-plugin-upcoming-event-list">
  <div class="tw-section">
    <img src="https://www.marymoorlive.com/images/claypool.jpg" alt="Claypool Gold poster">
    <div class="tw-name">
      <a href="https://www.marymoorlive.com/tm-event/claypool-gold/" title="Event Name - Claypool Gold | 23 May 6:00 PM">Claypool Gold</a>
    </div>
    <div class="tw-attractions">
      with <span>Les Claypool&#8217;s Frog Brigade</span>, <span>The Claypool Lennon Delirium</span>
    </div>
    <div class="tw-date-time">
      <span class="tw-event-date-complete"> <span class="tw-event-date">Saturday May 23, 2026</span></span>
    </div>
  </div>
  <div class="tw-section">
    <div class="tw-name">
      <a href="https://www.marymoorlive.com/tm-event/the-dead-south/" title="Event Name - The Dead South | 12 June 6:30 PM">The Dead South</a>
    </div>
    <div class="tw-attractions"></div>
    <span class="tw-event-date">Friday June 12, 2026</span>
  </div>
</div>
`;

const NOW = new Date("2026-04-29T12:00:00-07:00");

test("extractMarymoorListings reads public static Marymoor rows", () => {
  const listings = extractMarymoorListings(SAMPLE_HTML, NOW, "America/Los_Angeles");

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Claypool Gold");
  assert.equal(listings[0].date, "2026-05-23");
  assert.equal(listings[0].time, "6:00 PM");
  assert.equal(listings[0].url, "https://www.marymoorlive.com/tm-event/claypool-gold/");
  assert.equal(listings[0].imageUrl, "https://www.marymoorlive.com/images/claypool.jpg");
  assert.match(listings[0].description ?? "", /Les Claypool's Frog Brigade/);
});

test("parseMarymoor normalizes public concert rows into scout events", () => {
  const result = parseMarymoor(SAMPLE_HTML, {
    now: NOW,
    timezone: "America/Los_Angeles",
    source: {
      name: "Marymoor Park Concerts",
      url: "https://www.marymoorlive.com/",
      parser: "marymoor"
    }
  });

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.equal(result.events[0].venue, "Marymoor Park");
  assert.equal(result.events[0].location, "6046 West Lake Sammamish Parkway NE, Redmond, WA 98052");
  assert.equal(result.events[0].sourceName, "Marymoor Park Concerts");
  assert.equal(result.events[0].imageUrl, "https://www.marymoorlive.com/images/claypool.jpg");
  assert.equal(result.events[0].genreHints.includes("outdoor concert"), true);
  assert.match(result.statusMessage, /parsed Marymoor Live public concert rows/);
});
