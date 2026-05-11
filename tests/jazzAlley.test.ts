import test from "node:test";
import assert from "node:assert/strict";

import {
  extractJazzAlleyCalendarEntries,
  extractJazzAlleyPerformanceMap,
  extractJazzAlleyTicketPriceText,
  parseJazzAlleyDateRange
} from "../src/parsers/jazzAlley.js";

test("Jazz Alley calendar entries include normalized image URLs", () => {
  const html = `
    <div class="news-box">
      <div class="img-box">
        <a href="/www-home/artist.jsp?shownum=8772"><img src="/www-home/gallery/spyro2025_3.jpg" alt="Artist Gallery Photo" width="310" height="155" /></a>
      </div>
      <div class="text-box">
        <a href="/www-home/artist.jsp?shownum=8772"><h2>Spyro Gyra</h2></a>
        <em class="date">Thu, May 7 - Sun, May 10, 2026<br /></em>
        <p>Multi-platinum, 12x Grammy-nominated jazz legends</p>
      </div>
      <a href="/www-home/artist.jsp?shownum=8772" class="btn">info</a>
    </div>
    </div>
  `;

  const entries = extractJazzAlleyCalendarEntries(html);

  assert.equal(entries[0].title, "Spyro Gyra");
  assert.equal(entries[0].imageUrl, "https://www.jazzalley.com/www-home/gallery/spyro2025_3.jpg");
});

test("Jazz Alley date range expands across multiple nights", () => {
  const dates = parseJazzAlleyDateRange(
    "Thu, Apr 30 - Sun, May 3, 2026",
    new Date("2026-04-26T12:00:00-07:00"),
    "America/Los_Angeles"
  );

  assert.deepEqual(dates, ["2026-04-30", "2026-05-01", "2026-05-02", "2026-05-03"]);
});

test("Jazz Alley performance map groups same-day set times without changing dates", () => {
  const html = `
    <select name="perfnum">
      <option value="0">Choose a Performance</option>
      <option value="13419">Fri, May 1, 2026 7:30 PM</option>
      <option value="13420">Sat, May 2, 2026 7:30 PM</option>
      <option value="13421">Sat, May 2, 2026 9:30 PM</option>
    </select>
  `;

  const performanceMap = extractJazzAlleyPerformanceMap(
    html,
    new Date("2026-04-26T12:00:00-07:00"),
    "America/Los_Angeles"
  );

  assert.deepEqual(performanceMap.get("2026-05-01"), ["7:30 PM"]);
  assert.deepEqual(performanceMap.get("2026-05-02"), ["7:30 PM", "9:30 PM"]);
});

test("Jazz Alley ticket price text reads public detail page price and fee text", () => {
  const html = `
    <div class="artist-details">
      <h1>Vincent Ingala</h1>
      <p>Dinner and a show.</p>
      <p>$43.00 Includes a $12.50 Handling Fee</p>
    </div>
  `;

  assert.equal(
    extractJazzAlleyTicketPriceText(html),
    "$43.00 Includes a $12.50 Handling Fee"
  );
});

test("Jazz Alley ticket price text is omitted when no clear price is listed", () => {
  const html = `
    <div class="artist-details">
      <h1>Vincent Ingala</h1>
      <p>Choose a performance and join us for dinner.</p>
    </div>
  `;

  assert.equal(extractJazzAlleyTicketPriceText(html), undefined);
});
