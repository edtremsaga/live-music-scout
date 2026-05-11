import test from "node:test";
import assert from "node:assert/strict";

import { parseTractor } from "../src/parsers/tractor.js";

const NOW = new Date("2026-05-08T12:00:00-07:00");
const CONTEXT = {
  now: NOW,
  timezone: "America/Los_Angeles",
  source: {
    name: "Tractor Tavern",
    url: "https://www.tractortavern.com/calendar/",
    parser: "tractor"
  }
};

test("parseTractor attaches card-local TicketWeb background images", () => {
  const html = `
    <div class="flexmedia flexmedia--artistevents">
      <a href="https://www.ticketweb.com/event/an-evening-with-souled-american-tractor-tickets/14055874?pl=tractor&amp;REFID=clientsitewp" class="background-wrapper" style="background-image: url('https://i.ticketweb.com/i/00/12/78/38/04_Edp.jpg?v=5')"></a>
      <div class="eventinfo">
        <a href="https://www.ticketweb.com/event/an-evening-with-souled-american-tractor-tickets/14055874?pl=tractor&amp;REFID=clientsitewp"><span class="artisteventsname">An Evening with Souled American (partially seated)</span></a><br />
        <span class="artisteventstime">May 11 @ 08:00 PM </span><br />
        <span class="artistseventsprice">$31.26</span><br />
        <span class="artistseventsagelimit">Age Limit: 21+</span><br />
      </div>
    </div>
    <div class="flexmedia flexmedia--artistevents">
      <a href="https://www.ticketweb.com/event/hayden-everett-album-release-w-tractor-tickets/14779873?pl=tractor&amp;REFID=clientsitewp" class="background-wrapper" style='background-image: url("https://i.ticketweb.com/i/00/13/38/41/83_Edp.jpg?v=4")'></a>
      <div class="eventinfo">
        <a href="https://www.ticketweb.com/event/hayden-everett-album-release-w-tractor-tickets/14779873?pl=tractor&amp;REFID=clientsitewp"><span class="artisteventsname">Hayden Everett (Album Release) w/ Junaco, Kazmyn</span></a><br />
        <span class="artisteventstime">May 14 @ 07:30 PM </span><br />
        <span class="artistseventsprice">$18.90 - $24.04</span><br />
        <span class="artistseventsagelimit">Age Limit: 21+</span><br />
      </div>
    </div>
  `;

  const result = parseTractor(html, CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].title, "An Evening with Souled American (partially seated)");
  assert.equal(result.events[0].date, "2026-05-11");
  assert.equal(result.events[0].time, "08:00 PM");
  assert.equal(result.events[0].ticketPriceText, "$31.26");
  assert.equal(
    result.events[0].url,
    "https://www.ticketweb.com/event/an-evening-with-souled-american-tractor-tickets/14055874?pl=tractor&REFID=clientsitewp"
  );
  assert.equal(result.events[0].imageUrl, "https://i.ticketweb.com/i/00/12/78/38/04_Edp.jpg?v=5");
  assert.equal(result.events[0].imageAlt, "An Evening with Souled American (partially seated) event image");

  assert.equal(result.events[1].title, "Hayden Everett (Album Release) w/ Junaco, Kazmyn");
  assert.equal(result.events[1].ticketPriceText, "$18.90 - $24.04");
  assert.equal(result.events[1].imageUrl, "https://i.ticketweb.com/i/00/13/38/41/83_Edp.jpg?v=4");
  assert.equal(result.events[1].imageAlt, "Hayden Everett (Album Release) w/ Junaco, Kazmyn event image");
});
