import test from "node:test";
import assert from "node:assert/strict";

import { extractZooTunesListings, parseZooTunes } from "../src/parsers/zooTunes.js";

const SAMPLE_HTML = `
<figure class="wp-block-image size-full"><img src="yacht.jpg" /></figure>
<h4 class="wp-block-heading has-text-align-left">Yacht Rock Revue</h4>
<p class="has-text-align-left"><strong>June 4, 2026</strong></p>
<div class="wp-block-button"><a class="wp-block-button__link has-custom-font-size wp-element-button" href="https://www.etix.com/ticket/p/82884719/yacht-rock-revue-primetime-seattle-woodland-park-zoo">Buy TICKETS</a></div>

<figure class="wp-block-image size-full"><img src="belle.jpg" /></figure>
<h4 class="wp-block-heading has-text-align-center"><strong>SOLD OUT!</strong></h4>
<h4 class="wp-block-heading has-text-align-left">Belle and Sebastian 30th Anniversary Tour “If You’re Feeling Sinister” with Quasi</h4>
<p class="has-text-align-left"><strong>June 14, 2026</strong></p>
<p><a href="https://www.etix.com/ticket/p/81503289/belle-and-sebastian-addonzoocuterie-board-seattle-woodland-park-zoo">Add a Zoocuterie Board</a></p>
`;

const NOW = new Date("2026-04-29T12:00:00-07:00");

test("extractZooTunesListings reads public ZooTunes concert blocks", () => {
  const listings = extractZooTunesListings(SAMPLE_HTML, NOW, "America/Los_Angeles");

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Yacht Rock Revue");
  assert.equal(listings[0].date, "2026-06-04");
  assert.equal(
    listings[0].url,
    "https://www.etix.com/ticket/p/82884719/yacht-rock-revue-primetime-seattle-woodland-park-zoo"
  );
  assert.equal(listings[1].title, "Belle and Sebastian 30th Anniversary Tour “If You’re Feeling Sinister” with Quasi");
  assert.equal(listings[1].date, "2026-06-14");
  assert.equal(listings[1].url, "https://www.zoo.org/zootunes");
  assert.equal(listings[1].description, "SOLD OUT");
});

test("parseZooTunes normalizes public concert blocks into scout events", () => {
  const result = parseZooTunes(SAMPLE_HTML, {
    now: NOW,
    timezone: "America/Los_Angeles",
    source: {
      name: "Woodland Park Zoo / ZooTunes",
      url: "https://www.zoo.org/zootunes",
      parser: "zooTunes"
    }
  });

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.equal(result.events[0].venue, "Woodland Park Zoo");
  assert.equal(result.events[0].location, "5500 Phinney Ave N, Seattle, WA 98103");
  assert.equal(result.events[0].sourceName, "Woodland Park Zoo / ZooTunes");
  assert.equal(result.events[0].genreHints.includes("ZooTunes"), true);
  assert.match(result.statusMessage, /parsed ZooTunes public concert blocks/);
});
