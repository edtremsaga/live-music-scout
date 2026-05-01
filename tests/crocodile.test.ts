import test from "node:test";
import assert from "node:assert/strict";

import { extractCrocodileListings, parseCrocodile } from "../src/parsers/crocodile.js";

const SAMPLE_HTML = `
<ul>
  <li>
    <a href="https://www.ticketweb.com/event/moonchild-the-crocodile-tickets/1{{urlAskRef}}">Image: Moonchild, Brittney Carter</a>
    Moonchild, Brittney Carter Moonchild, Brittney Carter
    The Crocodile, Seattle, WA
    Fri May 1 8:00 PM (Doors 7:00 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/ground-zero-madame-lous-tickets/2">Image: Ground Zero Blues Club</a>
    Ground Zero Blues Club Ground Zero Blues Club
    Madame Lou's, Seattle, WA
    Sat May 2 6:30 PM (Doors 5:30 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/josh-gondelman-here-after-tickets/3">Image: Josh Gondelman, Andy Iwancio</a>
    Josh Gondelman, Andy Iwancio Josh Gondelman, Andy Iwancio
    Here - After, Seattle, WA
    Sun May 3 8:00 PM (Doors 7:00 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/croatian-roots-here-after-tickets/4">Image: Croatian Roots, American Problems w/ Stanko Zovak Band</a>
    Croatian Roots, American Problems w/ Stanko Zovak Band
    Here - After, Seattle, WA
    Mon May 4 7:00 PM (Doors 6:00 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/hotel-crocodile-lobby-tickets/5">Image: The Fem Du Lit Lobby Session</a>
    The Fem Du Lit Lobby Session
    Hotel Crocodile, Seattle, WA
    Tue May 5 8:00 PM (Doors 7:00 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/baba-yaga-party-tickets/6">Image: ALL YOUR FRIENDS</a>
    ALL YOUR FRIENDS
    Baba Yaga, Seattle, WA
    Wed May 6 10:15 PM (Doors 10:00 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/sunset-crosslist-tickets/7">Image: City of the Sun North American Tour 2026 w/ Portair</a>
    City of the Sun North American Tour 2026 w/ Portair
    Sunset Tavern, Seattle, WA
    Thu May 7 7:30 PM (Doors 6:30 PM)
    Find Tickets
  </li>
  <li>
    <a href="https://www.ticketweb.com/event/cancelled-crocodile-tickets/8">Image: Cancelled Crocodile Show</a>
    Cancelled Crocodile Show
    The Crocodile, Seattle, WA
    Fri May 8 8:00 PM (Doors 7:00 PM)
    Cancelled
  </li>
</ul>
`;

const NOW = new Date("2026-05-01T12:00:00-07:00");
const CONTEXT = {
  now: NOW,
  timezone: "America/Los_Angeles",
  source: {
    name: "The Crocodile",
    url: "https://www.ticketweb.com/events/org/243963",
    parser: "crocodile"
  }
};

test("extractCrocodileListings includes Crocodile and Madame Lou's and carefully filters Here-After", () => {
  const listings = extractCrocodileListings(SAMPLE_HTML, CONTEXT);

  assert.deepEqual(listings.map((listing) => listing.title), [
    "Moonchild, Brittney Carter",
    "Ground Zero Blues Club",
    "Croatian Roots, American Problems w/ Stanko Zovak Band"
  ]);
  assert.equal(listings[0].venue, "The Crocodile");
  assert.equal(listings[0].date, "2026-05-01");
  assert.equal(listings[0].time, "8:00 PM");
  assert.equal(listings[0].url, "https://www.ticketweb.com/event/moonchild-the-crocodile-tickets/1");
  assert.equal(listings[1].venue, "Madame Lou's");
  assert.equal(listings[2].venue, "Here - After");
});

test("parseCrocodile normalizes included TicketWeb rows into scout events", () => {
  const result = parseCrocodile(SAMPLE_HTML, CONTEXT);

  assert.equal(result.events.length, 3);
  assert.equal(result.candidateCount, 3);
  assert.equal(result.parserConfidence, "High");
  assert.equal(result.events[0].sourceName, "The Crocodile");
  assert.equal(result.events[0].location, "2505 1st Ave, Seattle, WA 98121");
  assert.equal(result.events[0].genreHints.includes("Belltown club"), true);
  assert.match(result.events[0].basis, /included The Crocodile and Madame Lou's listings/);
  assert.match(result.statusMessage, /explicit venue filtering/);
});
