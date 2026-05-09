import test from "node:test";
import assert from "node:assert/strict";

import { extractShowboxPresentsListings, parseShowboxPresents } from "../src/parsers/showboxPresents.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

function makeSource(): SourceConfig {
  return {
    name: "Showbox Presents",
    url: "https://www.showboxpresents.com/events/all",
    parser: "showboxPresents",
    location: "Seattle, WA",
    areaTags: ["Seattle", "Downtown", "SoDo"],
    sourceType: "promoter",
    musicOnly: true,
    coveredVenues: ["Showbox at the Market", "Showbox SoDo"],
    parserStatus: "live"
  };
}

function makeContext(): ParserContext {
  return {
    source: makeSource(),
    now: new Date("2026-05-08T12:00:00-07:00"),
    timezone: "America/Los_Angeles"
  };
}

const FIXTURE_HTML = `
<div id="eventsList">
  <div class="entry clearfix" data-state="WA">
    <div class="thumb">
      <a href="https://www.showboxpresents.com/events/detail/1191544" title="More Info">
        <img src="https://images.discovery-prod.axs.com/2025/10/puscifer.jpg" alt=""/>
      </a>
    </div>
    <div class="info">
      <div class="title">
        <h5 class="accentColor animated">Showbox and Monqui Present</h5>
        <h5>The Normal Isn't Tour</h5>
        <h3 class="carousel_item_title_small">
          <a href="https://www.showboxpresents.com/events/detail/1191544" title="More Info">Puscifer</a>
        </h3>
        <h4 class="animated">with Dave Hill</h4>
      </div>
      <div class="date-time-container">
        <span class="date"><span class="fa fa-calendar-o"></span>Sat, May 9, 2026</span>
        <span class="time"><span class="fa fa-clock-o"></span>Show 8:00 PM</span>
        <span class="venue"><span class="accentColor">@</span> WAMU Theater</span>
      </div>
    </div>
    <div class="buttons">
      <a href="https://www.axs.com/events/1191544/puscifer-tickets" title="Buy Tickets">Buy Tickets</a>
    </div>
  </div>

  <div class="entry alt showboxpresents clearfix" data-state="WA">
    <div class="thumb">
      <a href="https://www.showboxpresents.com/events/detail/1237576" title="More Info">
        <img src="https://images.discovery-prod.axs.com/2025/12/good-kid.jpg" alt=""/>
      </a>
    </div>
    <div class="info">
      <div class="title">
        <h5 class="accentColor animated">Showbox Presents</h5>
        <h5>Can We Hang Out? Tour</h5>
        <h3 class="carousel_item_title_small">
          <a href="https://www.showboxpresents.com/events/detail/1237576" title="More Info">Good Kid</a>
        </h3>
        <h4 class="animated">with INOHA</h4>
      </div>
      <div class="date-time-container">
        <span class="date"><span class="fa fa-calendar-o"></span>Sat, May 9, 2026</span>
        <span class="time"><span class="fa fa-clock-o"></span>Show 8:00 PM</span>
        <span class="venue"><span class="accentColor">@</span> Showbox SoDo</span>
      </div>
    </div>
    <div class="buttons">
      <a href="https://www.axs.com/events/1237576/good-kid-tickets" title="Buy Tickets">Buy Tickets</a>
    </div>
  </div>

  <div class="entry showboxpresents clearfix" data-state="WA">
    <div class="thumb">
      <a href="/events/detail/1322108" title="More Info">
        <img src="https://images.discovery-prod.axs.com/2024/01/cyclops.jpg" alt=""/>
      </a>
    </div>
    <div class="info">
      <div class="title">
        <h5 class="accentColor animated">Showbox Presents</h5>
        <h5></h5>
        <h3 class="carousel_item_title_small">
          <a href="/events/detail/1322108" title="More Info">Cyclops</a>
        </h3>
        <h4 class="animated">with Lumasi, Gardella, Keeb</h4>
      </div>
      <div class="date-time-container">
        <span class="date"><span class="fa fa-calendar-o"></span>Sat, May 9, 2026</span>
        <span class="time"><span class="fa fa-clock-o"></span>Show 9:00 PM</span>
        <span class="venue"><span class="accentColor">@</span> The Showbox</span>
      </div>
    </div>
    <div class="buttons">
      <a href="https://www.axs.com/events/1322108/cyclops-tickets" title="Buy Tickets">Buy Tickets</a>
    </div>
  </div>
</div>
`;

test("extractShowboxPresentsListings keeps only Showbox venues and extracts thumbnails", () => {
  const listings = extractShowboxPresentsListings(FIXTURE_HTML, makeContext());

  assert.equal(listings.length, 2);
  assert.deepEqual(listings.map((listing) => listing.title), ["Good Kid", "Cyclops"]);
  assert.equal(listings[0].venue, "Showbox SoDo");
  assert.equal(listings[0].date, "2026-05-09");
  assert.equal(listings[0].time, "8:00 PM");
  assert.equal(listings[0].description, "Showbox Presents; Can We Hang Out? Tour; with INOHA");
  assert.equal(listings[0].imageUrl, "https://images.discovery-prod.axs.com/2025/12/good-kid.jpg");
  assert.equal(listings[1].venue, "Showbox at the Market");
  assert.equal(listings[1].location, "1426 1st Ave, Seattle, WA 98101");
  assert.equal(listings[1].url, "https://www.showboxpresents.com/events/detail/1322108");
});

test("parseShowboxPresents normalizes included venue rows into scout events", () => {
  const result = parseShowboxPresents(FIXTURE_HTML, makeContext());

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.events[0].venue, "Showbox SoDo");
  assert.equal(result.events[0].location, "1700 1st Ave S, Seattle, WA 98134");
  assert.equal(result.events[0].imageAlt, "Good Kid event image");
  assert.equal(result.events[0].sourceName, "Showbox Presents");
  assert.equal(result.events[1].venue, "Showbox at the Market");
  assert.equal(result.events[1].imageUrl, "https://images.discovery-prod.axs.com/2024/01/cyclops.jpg");
  assert.match(result.statusMessage, /The Showbox and Showbox SoDo/);
});
