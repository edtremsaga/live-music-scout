import test from "node:test";
import assert from "node:assert/strict";

import {
  generateEmailHtml,
  generateEmailPreview,
  generateWeeklyEmailPreview,
  getSourceLinkLabel
} from "../src/generateEmail.js";
import type { RankedEvent } from "../src/types.js";

function makeRankedEvent(overrides: Partial<RankedEvent>): RankedEvent {
  return {
    id: "ranked-event",
    title: "Test Event",
    artist: "Test Event",
    venue: "Test Venue",
    date: "2026-04-25",
    url: "https://example.com/events/test",
    sourceName: "Test Source",
    genreHints: [],
    confidence: "Medium",
    basis: "fixture basis",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "Medium",
      eventType: "music",
      fitReason: "fixture fit reason"
    },
    score: 10,
    verdict: "Go",
    matchReasons: ["fixture reason"],
    isSeen: false,
    ...overrides
  };
}

test("TicketWeb link gets Tractor/TicketWeb label for Tractor event", () => {
  const event = makeRankedEvent({
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/example"
  });

  assert.equal(getSourceLinkLabel(event), "Tractor/TicketWeb listing");
});

test("STG URL gets STG event page label", () => {
  const event = makeRankedEvent({
    sourceName: "STG Presents",
    venue: "The Neptune Theatre",
    url: "https://www.stgpresents.org/events/example"
  });

  assert.equal(getSourceLinkLabel(event), "STG event page");
});

test("Jazz Alley URL gets Jazz Alley event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Dimitriou's Jazz Alley",
    venue: "Dimitriou's Jazz Alley",
    url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=8764"
  });

  assert.equal(getSourceLinkLabel(event), "Jazz Alley event page");
});

test("fallback URL gets Event page label", () => {
  const event = makeRankedEvent({
    url: "https://example.com/events/test"
  });

  assert.equal(getSourceLinkLabel(event), "Event page");
});

test("markdown preview uses friendly source markdown link", () => {
  const event = makeRankedEvent({
    sourceName: "STG Presents",
    venue: "The Neptune Theatre",
    url: "https://www.stgpresents.org/events/example"
  });

  const output = generateEmailPreview(new Date("2026-04-25T19:00:00-07:00"), [event]);
  assert.match(output, /Source: \[STG event page\]\(https:\/\/www\.stgpresents\.org\/events\/example\)/);
  assert.doesNotMatch(output, /Source link: https:\/\/www\.stgpresents\.org\/events\/example/);
});

test("preview uses highlights and all evaluated sections", () => {
  const event = makeRankedEvent({
    sourceName: "Tractor Tavern",
    venue: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/example"
  });

  const output = generateEmailPreview(new Date("2026-04-25T19:00:00-07:00"), [event]);
  assert.match(output, /## Tonight’s Highlights/);
  assert.match(output, /## All Evaluated Shows/);
});

test("html output includes clickable anchor tags", () => {
  const event = makeRankedEvent({
    sourceName: "The Royal Room",
    venue: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/example"
  });

  const html = generateEmailHtml(new Date("2026-04-25T19:00:00-07:00"), [event]);
  assert.match(html, /<a href="https:\/\/theroyalroomseattle\.com\/event\/example">Royal Room event page<\/a>/);
});

test("weekly preview groups evaluated shows by day", () => {
  const highlight = makeRankedEvent({
    title: "Monday Highlight",
    artist: "Monday Highlight",
    date: "2026-04-27",
    verdict: "Go"
  });
  const remaining = makeRankedEvent({
    id: "remaining-event",
    title: "Tuesday Event",
    artist: "Tuesday Event",
    date: "2026-04-28",
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "Low",
      eventType: "talk",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-25T19:00:00-07:00"),
    [highlight, remaining],
    "2026-04-25",
    "2026-05-02"
  );

  assert.match(output, /## This Week’s Highlights/);
  assert.match(output, /## Evaluated Shows by Day/);
  assert.match(output, /### Tuesday, April 28/);
  assert.match(output, /Tuesday Event — Test Venue/);
});

test("weekly preview dedupes repeated multi-night highlights but keeps dated events by day", () => {
  const runNightOne = makeRankedEvent({
    id: "vincent-night-one",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/night-one",
    date: "2026-04-30",
    time: "8:30 PM",
    score: 20,
    verdict: "Go"
  });
  const runNightTwo = makeRankedEvent({
    id: "vincent-night-two",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/night-two",
    date: "2026-05-01",
    time: "8:30 PM",
    score: 19,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [runNightOne, runNightTwo],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### KEXP's Roadhouse Presents: Vincent Neil Emerson w\/ Kade Hoffman/);
  assert.doesNotMatch(output, /### .*BOTH SHOWS/);
  assert.doesNotMatch(output, /### .*NIGHT ONE/);
  assert.doesNotMatch(output, /### .*NIGHT TWO/);
  assert.match(output, /- Dates: Thu, Apr 30, Fri, May 1/);
  assert.match(output, /### Thursday, April 30[\s\S]*Highlighted above\./);
  assert.match(output, /### Friday, May 1[\s\S]*Highlighted above\./);
});

test("weekly highlights apply a light venue diversity cap when alternatives exist", () => {
  const tractorOne = makeRankedEvent({
    id: "tractor-one",
    title: "Tractor One",
    artist: "Tractor One",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/tractor-one",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const tractorTwo = makeRankedEvent({
    id: "tractor-two",
    title: "Tractor Two",
    artist: "Tractor Two",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/tractor-two",
    date: "2026-04-27",
    score: 29,
    verdict: "Go"
  });
  const tractorThree = makeRankedEvent({
    id: "tractor-three",
    title: "Tractor Three",
    artist: "Tractor Three",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/tractor-three",
    date: "2026-04-28",
    score: 28,
    verdict: "Go"
  });
  const jazzAlley = makeRankedEvent({
    id: "jazz-alley",
    title: "Pat Metheny Side-Eye III+",
    artist: "Pat Metheny Side-Eye III+",
    venue: "Dimitriou's Jazz Alley",
    sourceName: "Dimitriou's Jazz Alley",
    url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=8739",
    date: "2026-04-29",
    score: 18,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [tractorOne, tractorTwo, tractorThree, jazzAlley],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### Tractor One/);
  assert.match(output, /### Tractor Two/);
  assert.doesNotMatch(output, /### Tractor Three/);
  assert.match(output, /### Pat Metheny Side-Eye III\+/);
});

test("weekly diversity does not force weak events into highlights", () => {
  const tractorOne = makeRankedEvent({
    id: "strong-one",
    title: "Strong One",
    artist: "Strong One",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/strong-one",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const tractorTwo = makeRankedEvent({
    id: "strong-two",
    title: "Strong Two",
    artist: "Strong Two",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/strong-two",
    date: "2026-04-27",
    score: 29,
    verdict: "Go"
  });
  const tractorThree = makeRankedEvent({
    id: "strong-three",
    title: "Strong Three",
    artist: "Strong Three",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/strong-three",
    date: "2026-04-28",
    score: 28,
    verdict: "Go"
  });
  const weakOtherVenue = makeRankedEvent({
    id: "weak-other",
    title: "Weak Other",
    artist: "Weak Other",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/weak-other",
    date: "2026-04-29",
    score: -2,
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "Low",
      eventType: "talk",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [tractorOne, tractorTwo, tractorThree, weakOtherVenue],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### Strong One/);
  assert.match(output, /### Strong Two/);
  assert.match(output, /### Strong Three/);
  assert.doesNotMatch(output, /### Weak Other/);
});

test("weekly preview does not merge unrelated shows that share generic words", () => {
  const first = makeRankedEvent({
    id: "first-album-release",
    title: "Jessie Thoreson & The Crown Fire (album release) w/ Kate Dinsmore",
    artist: "Jessie Thoreson & The Crown Fire (album release) w/ Kate Dinsmore",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/jessie",
    date: "2026-04-30",
    score: 18,
    verdict: "Go"
  });
  const second = makeRankedEvent({
    id: "second-album-release",
    title: "Som da Massa Album Release",
    artist: "Som da Massa Album Release",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/som",
    date: "2026-05-03",
    score: 17,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [first, second],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### Jessie Thoreson & The Crown Fire \(album release\) w\/ Kate Dinsmore/);
  assert.match(output, /### Som da Massa Album Release/);
});

test("display text decodes HTML entities without changing URLs", () => {
  const decodedTitleEvent = makeRankedEvent({
    title: "Brazilian Showcase &#038; Solstice Parade Launch &#8211; Late Set",
    artist: "Brazilian Showcase &#038; Solstice Parade Launch &#8211; Late Set",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/brazilianshowase/?foo=bar&baz=qux",
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "Low",
      eventType: "unknown",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateEmailPreview(new Date("2026-04-25T19:00:00-07:00"), [decodedTitleEvent]);
  assert.match(output, /Brazilian Showcase & Solstice Parade Launch – Late Set/);
  assert.match(output, /\[Royal Room event page\]\(https:\/\/theroyalroomseattle\.com\/event\/brazilianshowase\/\?foo=bar&baz=qux\)/);
});
