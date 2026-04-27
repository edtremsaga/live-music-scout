import test from "node:test";
import assert from "node:assert/strict";

import { extractSkylarkListings } from "../src/parsers/skylark.js";

const SAMPLE_HTML = `
<div role="listitem" class="collection-item-3 w-dyn-item">
  <div class="event-cal">
    <div class="container-7 w-container">
      <div class="sig-header">
        <div class="text-block-12">Swinson, The Rolling Thunder, Will Rainier &amp; the Pines</div>
        <div class="date">May 1, 2026 8:00 PM</div>
      </div>
      <div class="event-listing">
        <div class="info-block">
          <div class="rich-text-block-10 w-richtext"><p>Doors 7 music 8</p></div>
        </div>
        <a href="/global-events/swinson-the-rolling-thunder-will-rainier-the-pines" class="link-block-4 w-inline-block">
          <div class="ev-name lebutton top-padder">Learn More</div>
        </a>
      </div>
    </div>
  </div>
</div>
`;

test("extractSkylarkListings pulls normalized upcoming event data from Skylark calendar cards", () => {
  const listings = extractSkylarkListings(SAMPLE_HTML);

  assert.equal(listings.length, 1);
  assert.equal(listings[0].title, "Swinson, The Rolling Thunder, Will Rainier & the Pines");
  assert.equal(listings[0].date, "2026-05-01");
  assert.equal(listings[0].time, "8:00 PM");
  assert.equal(
    listings[0].url,
    "https://www.skylarkcafe.com/global-events/swinson-the-rolling-thunder-will-rainier-the-pines"
  );
});
