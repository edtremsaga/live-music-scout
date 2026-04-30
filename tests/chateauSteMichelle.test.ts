import test from "node:test";
import assert from "node:assert/strict";

import { extractChateauSteMichelleListings, parseChateauSteMichelle } from "../src/parsers/chateauSteMichelle.js";

const SAMPLE_HTML = `
<div class="event-list">
  <div class="event-list-event">
    <div class="event-list-image">
      <a class="event-list-image-link" href="/yellowcard%3A-the-up-up-down-down-tour/5637778332.p">
        <img alt="Yellowcard image"/>
      </a>
    </div>
    <div class="event-list-details">
      <div class="event-list-date">
        <div class="event-list-single">
          <span class="event-list-month-S">5</span>
          <span class="event-list-month-M">May</span>
          <span class="event-list-month-L">May</span>
          <span class="event-list-day">24</span>
          <span class="event-list-year-S">26</span>
          <span class="event-list-year-L">2026</span>
        </div>
      </div>
      <div class="event-list-category">SUMMER CONCERTS</div>
      <a class="event-list-name" href="/yellowcard%3A-the-up-up-down-down-tour/5637778332.p">Yellowcard: The Up Up Down Down Tour</a>
      <div class="event-list-intro">With Special Guests New Found Glory and Plain White T&apos;s<br/>Show starts at 6:00pm<br/>For tickets, visit <a href="https://www.ticketmaster.com/Chateau-Ste-Michelle-Winery-tickets-Woodinville/venue/122914"><strong>ticketmaster.com</strong></a> to purchase.<br/><strong>Questions? <a href="https://www.ste-michelle.com/visit-us/summer-concerts/faq">See our Summer Concert FAQs</a></strong></div>
      <div class="event-list-location">Chateau Ste. Michelle Amphitheatre</div>
      <div class="event-list-time">6:00pm</div>
      <div class="event-list-button"><a class="event-list-button-link" href="/yellowcard%3A-the-up-up-down-down-tour/5637778332.p">Details</a></div>
    </div>
  </div>
  <div class="event-list-event">
    <div class="event-list-details">
      <div class="event-list-date">
        <div class="event-list-single">
          <span class="event-list-month-M">Jun</span>
          <span class="event-list-day">6</span>
          <span class="event-list-year-L">2026</span>
        </div>
      </div>
      <div class="event-list-category">LIVE MUSIC</div>
      <a class="event-list-name" href="/bob-dylan/5637795577.p">Bob Dylan</a>
      <div class="event-list-intro">With Lucinda Williams and Her Band &amp; The John Doe Folk Trio</div>
      <div class="event-list-location">Chateau Ste. Michelle Amphitheatre</div>
      <div class="event-list-time">6:30pm</div>
    </div>
  </div>
</div>
`;

const NOW = new Date("2026-04-29T12:00:00-07:00");

test("extractChateauSteMichelleListings reads public static event rows", () => {
  const listings = extractChateauSteMichelleListings(SAMPLE_HTML, NOW, "America/Los_Angeles");

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Yellowcard: The Up Up Down Down Tour");
  assert.equal(listings[0].date, "2026-05-24");
  assert.equal(listings[0].time, "6:00 PM");
  assert.equal(listings[0].location, "Chateau Ste. Michelle Amphitheatre");
  assert.equal(
    listings[0].url,
    "https://www.ste-michelle.com/yellowcard%3A-the-up-up-down-down-tour/5637778332.p"
  );
  assert.match(listings[0].description ?? "", /New Found Glory and Plain White T's/);
  assert.doesNotMatch(listings[0].description ?? "", /Questions\?/);
});

test("parseChateauSteMichelle normalizes public concert rows into scout events", () => {
  const result = parseChateauSteMichelle(SAMPLE_HTML, {
    now: NOW,
    timezone: "America/Los_Angeles",
    source: {
      name: "Chateau Ste. Michelle Summer Concerts",
      url: "https://www.ste-michelle.com/visit-us/summer-concerts",
      parser: "chateauSteMichelle"
    }
  });

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.equal(result.events[0].venue, "Chateau Ste. Michelle Amphitheatre");
  assert.equal(result.events[0].location, "14111 NE 145th Street, Woodinville, WA 98072");
  assert.equal(result.events[0].sourceName, "Chateau Ste. Michelle Summer Concerts");
  assert.equal(result.events[0].confidence, "High");
  assert.equal(result.events[0].genreHints.includes("outdoor concert"), true);
  assert.match(result.statusMessage, /parsed Chateau Ste\. Michelle public summer concert rows/);
});
