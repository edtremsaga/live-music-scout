import test from "node:test";
import assert from "node:assert/strict";

import {
  generateEmailHtml,
  generateEmailPreview,
  generateWeeklyEmailHtml,
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

test("Triple Door URL gets The Triple Door event page label", () => {
  const event = makeRankedEvent({
    sourceName: "The Triple Door",
    venue: "The Triple Door",
    url: "https://thetripledoor.net/event/1/101/test-artist"
  });

  assert.equal(getSourceLinkLabel(event), "The Triple Door event page");
});

test("Bake's Place URL gets Bake's Place event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Bake's Place",
    venue: "Bake's Place",
    url: "https://bakesplacebellevue.com/bellevue-bellevue-bake-s-place-bar-and-bistro-live-music"
  });

  assert.equal(getSourceLinkLabel(event), "Bake's Place event page");
});

test("Nectar Lounge URL gets Nectar Lounge event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Nectar Lounge",
    venue: "Nectar Lounge",
    url: "https://www.tixr.com/groups/nectarlounge/events/test-show"
  });

  assert.equal(getSourceLinkLabel(event), "Nectar Lounge event page");
});

test("Hidden Hall URL gets Hidden Hall event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Hidden Hall",
    venue: "Hidden Hall",
    url: "https://www.tixr.com/groups/hiddenhall/events/test-show"
  });

  assert.equal(getSourceLinkLabel(event), "Hidden Hall event page");
});

test("Skylark Cafe URL gets Skylark Cafe event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Skylark Cafe",
    venue: "Skylark Cafe",
    url: "https://www.skylarkcafe.com/global-events/test-show"
  });

  assert.equal(getSourceLinkLabel(event), "Skylark Cafe event page");
});

test("Sunset Tavern DICE URL gets Sunset Tavern event page label", () => {
  const event = makeRankedEvent({
    sourceName: "Sunset Tavern",
    venue: "Sunset Tavern",
    url: "https://link.dice.fm/example"
  });

  assert.equal(getSourceLinkLabel(event), "Sunset Tavern event page");
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

test("daily preview separates Go highlights from Maybe also-worth-checking items", () => {
  const olllam = makeRankedEvent({
    id: "olllam",
    title: "the olllam w/ Lila Forde",
    artist: "the olllam w/ Lila Forde",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/olllam",
    score: 18,
    verdict: "Go"
  });
  const karrin = makeRankedEvent({
    id: "karrin",
    title: "Karrin Allyson",
    artist: "Karrin Allyson",
    venue: "Dimitriou's Jazz Alley",
    sourceName: "Dimitriou's Jazz Alley",
    url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=8764",
    score: 17,
    verdict: "Go"
  });
  const dervish = makeRankedEvent({
    id: "dervish",
    title: "Dervish",
    artist: "Dervish",
    venue: "The Triple Door",
    sourceName: "The Triple Door",
    url: "https://thetripledoor.net/event/6337819/743008797/dervish",
    score: 16,
    verdict: "Go"
  });
  const alice = makeRankedEvent({
    id: "alice",
    title: "Alice Phoebe Lou",
    artist: "Alice Phoebe Lou",
    venue: "The Neptune Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/alice-phoebe-lou/",
    score: 5,
    verdict: "Maybe"
  });
  const helloween = makeRankedEvent({
    id: "helloween",
    title: "Helloween",
    artist: "Helloween",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/helloween/",
    score: 4,
    verdict: "Maybe"
  });
  const quiltSessions = makeRankedEvent({
    id: "quilt-sessions",
    title: "The Quilt Sessions: April",
    artist: "The Quilt Sessions: April",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/the-quilt-sessions-april26-3/",
    score: -2,
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "Low",
      eventType: "unknown",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateEmailPreview(
    new Date("2026-04-28T12:00:00-07:00"),
    [olllam, karrin, dervish, alice, helloween, quiltSessions]
  );
  const highlightsSection = output.slice(output.indexOf("## Tonight’s Highlights"), output.indexOf("## Also Worth Checking"));
  const alsoWorthCheckingSection = output.slice(output.indexOf("## Also Worth Checking"), output.indexOf("## All Evaluated Shows"));
  const evaluatedSection = output.slice(output.indexOf("## All Evaluated Shows"));

  assert.match(highlightsSection, /### the olllam w\/ Lila Forde/);
  assert.match(highlightsSection, /### Karrin Allyson/);
  assert.match(highlightsSection, /### Dervish/);
  assert.doesNotMatch(highlightsSection, /### Alice Phoebe Lou/);
  assert.doesNotMatch(highlightsSection, /### Helloween/);
  assert.match(alsoWorthCheckingSection, /### Alice Phoebe Lou/);
  assert.match(alsoWorthCheckingSection, /### Helloween/);
  assert.match(evaluatedSection, /The Quilt Sessions: April/);
  assert.doesNotMatch(evaluatedSection, /Alice Phoebe Lou/);
  assert.doesNotMatch(evaluatedSection, /Helloween/);
});

test("daily html includes Also Worth Checking when Maybe items are present", () => {
  const highlight = makeRankedEvent({
    id: "highlight",
    title: "Strong Pick",
    artist: "Strong Pick",
    verdict: "Go",
    score: 12
  });
  const maybe = makeRankedEvent({
    id: "maybe",
    title: "Maybe Pick",
    artist: "Maybe Pick",
    verdict: "Maybe",
    score: 4
  });

  const html = generateEmailHtml(new Date("2026-04-28T12:00:00-07:00"), [highlight, maybe]);

  assert.match(html, /<h2>Also Worth Checking<\/h2>/);
  assert.ok(html.indexOf("<h3>Maybe Pick</h3>") > html.indexOf("<h2>Also Worth Checking</h2>"));
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

test("weekly preview groups Sunset album-release night runs but keeps nightly evaluated entries", () => {
  const nightOne = makeRankedEvent({
    id: "zookraught-night-one",
    title: "Zookraught Album Release Night 1 w/ Constant Lovers, OGRE, Miscomings",
    artist: "Zookraught, OGRE, Miscomings, Constant Lovers",
    venue: "Sunset Tavern",
    sourceName: "Sunset Tavern",
    url: "https://link.dice.fm/night-one",
    date: "2026-05-01",
    time: "9:00 PM",
    score: 14,
    verdict: "Go"
  });
  const nightTwo = makeRankedEvent({
    id: "zookraught-night-two",
    title: "Zookraught Album Release Night 2 w/ Black Ends, LOOLOWNINGEN, All of Our Cornbread",
    artist: "Zookraught, Black Ends, LOOLOWNINGEN & THE FAR EAST IDIOTS",
    venue: "Sunset Tavern",
    sourceName: "Sunset Tavern",
    url: "https://link.dice.fm/night-two",
    date: "2026-05-02",
    time: "9:00 PM",
    score: 14,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-29T12:00:00-07:00"),
    [nightOne, nightTwo],
    "2026-04-29",
    "2026-05-06"
  );

  assert.match(output, /### Zookraught Album Release/);
  assert.doesNotMatch(output, /### Zookraught, OGRE, Miscomings, Constant Lovers/);
  assert.doesNotMatch(output, /### Zookraught, Black Ends, LOOLOWNINGEN/);
  assert.match(output, /- Dates: Fri, May 1, Sat, May 2/);
  assert.match(output, /### Friday, May 1[\s\S]*Zookraught, OGRE, Miscomings, Constant Lovers[\s\S]*Highlighted above\./);
  assert.match(output, /### Saturday, May 2[\s\S]*Zookraught, Black Ends, LOOLOWNINGEN & THE FAR EAST IDIOTS[\s\S]*Highlighted above\./);
});

test("weekly preview caps highlights and adds also worth a look", () => {
  const events = Array.from({ length: 8 }, (_, index) => makeRankedEvent({
    id: `weekly-pick-${index + 1}`,
    title: `Weekly Pick ${index + 1}`,
    artist: `Weekly Pick ${index + 1}`,
    venue: `Venue ${index + 1}`,
    sourceName: `Source ${index + 1}`,
    url: `https://example.com/weekly-pick-${index + 1}`,
    date: `2026-05-0${Math.min(index + 1, 5)}`,
    score: 30 - index,
    verdict: "Go"
  }));

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    events,
    "2026-04-26",
    "2026-05-03"
  );
  const highlightsSection = output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Also Worth a Look"));
  const alsoWorthSection = output.slice(output.indexOf("## Also Worth a Look"), output.indexOf("## Evaluated Shows by Day"));

  assert.equal((highlightsSection.match(/^### /gm) ?? []).length, 6);
  assert.match(highlightsSection, /### Weekly Pick 1/);
  assert.match(highlightsSection, /### Weekly Pick 6/);
  assert.doesNotMatch(highlightsSection, /### Weekly Pick 7/);
  assert.match(alsoWorthSection, /### Weekly Pick 7/);
  assert.match(alsoWorthSection, /### Weekly Pick 8/);
  assert.match(output, /Weekly Pick 7 — Venue 7[\s\S]*Also worth a look above\./);
  assert.doesNotMatch(alsoWorthSection, /### Weekly Pick 1/);
});

test("weekly html includes Also Worth a Look when secondary picks exist", () => {
  const events = Array.from({ length: 7 }, (_, index) => makeRankedEvent({
    id: `html-weekly-pick-${index + 1}`,
    title: `HTML Weekly Pick ${index + 1}`,
    artist: `HTML Weekly Pick ${index + 1}`,
    venue: `HTML Venue ${index + 1}`,
    sourceName: `HTML Source ${index + 1}`,
    url: `https://example.com/html-weekly-pick-${index + 1}`,
    date: "2026-05-01",
    score: 30 - index,
    verdict: "Go"
  }));

  const html = generateWeeklyEmailHtml(
    new Date("2026-04-26T12:00:00-07:00"),
    events,
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(html, /<h2>Also Worth a Look<\/h2>/);
  assert.ok(html.indexOf("<h3>HTML Weekly Pick 7</h3>") > html.indexOf("<h2>Also Worth a Look</h2>"));
});

test("weekly top sections skip generic Royal Room happy hour listings", () => {
  const strongPicks = Array.from({ length: 8 }, (_, index) => makeRankedEvent({
    id: `strong-weekly-${index + 1}`,
    title: `Strong Weekly ${index + 1}`,
    artist: `Strong Weekly ${index + 1}`,
    venue: `Venue ${index + 1}`,
    sourceName: `Source ${index + 1}`,
    url: `https://example.com/strong-weekly-${index + 1}`,
    date: `2026-05-0${Math.min(index + 1, 5)}`,
    score: 30 - index,
    verdict: "Go"
  }));
  const happyHour = makeRankedEvent({
    id: "happy-hour-sheryl",
    title: "Happy Hour with Sheryl Wiser",
    artist: "Happy Hour with Sheryl Wiser",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/happy-hour-sheryl-wiser/",
    date: "2026-05-01",
    score: 29,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [strongPicks[0], happyHour, ...strongPicks.slice(1)],
    "2026-04-26",
    "2026-05-03"
  );
  const topSections = output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Evaluated Shows by Day"));
  const evaluatedSection = output.slice(output.indexOf("## Evaluated Shows by Day"));

  assert.doesNotMatch(topSections, /### Happy Hour with Sheryl Wiser/);
  assert.match(evaluatedSection, /Happy Hour with Sheryl Wiser — The Royal Room/);
  assert.doesNotMatch(evaluatedSection, /Happy Hour with Sheryl Wiser[^\n]*Also worth a look above\./);
  assert.doesNotMatch(evaluatedSection, /Happy Hour with Sheryl Wiser[^\n]*Highlighted above\./);
});

test("weekly top sections allow Royal Room happy hour listings with strong music signals", () => {
  const strongPicks = Array.from({ length: 6 }, (_, index) => makeRankedEvent({
    id: `strong-weekly-signal-${index + 1}`,
    title: `Strong Weekly Signal ${index + 1}`,
    artist: `Strong Weekly Signal ${index + 1}`,
    venue: `Venue ${index + 1}`,
    sourceName: `Source ${index + 1}`,
    url: `https://example.com/strong-weekly-signal-${index + 1}`,
    date: `2026-05-0${Math.min(index + 1, 5)}`,
    score: 30 - index,
    verdict: "Go"
  }));
  const happyHourTrio = makeRankedEvent({
    id: "happy-hour-trio",
    title: "Happy Hour Trio Album Release",
    artist: "Happy Hour Trio Album Release",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/happy-hour-trio-album-release/",
    date: "2026-05-01",
    score: 23,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [...strongPicks, happyHourTrio],
    "2026-04-26",
    "2026-05-03"
  );
  const topSections = output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Evaluated Shows by Day"));

  assert.match(topSections, /### Happy Hour Trio Album Release/);
});

test("single-date weekly highlights show date and time in markdown and html", () => {
  const jessie = makeRankedEvent({
    id: "jessie",
    title: "Jessie Thoreson & The Crown Fire (album release) w/ Kate Dinsmore",
    artist: "Jessie Thoreson & The Crown Fire (album release) w/ Kate Dinsmore",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/jessie",
    date: "2026-04-30",
    time: "7:30 PM",
    score: 20,
    verdict: "Go"
  });

  const preview = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [jessie],
    "2026-04-26",
    "2026-05-03"
  );
  const html = generateWeeklyEmailHtml(
    new Date("2026-04-26T12:00:00-07:00"),
    [jessie],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(preview, /### Jessie Thoreson & The Crown Fire \(album release\) w\/ Kate Dinsmore\n- Venue: Tractor Tavern\n- Date: Thu, Apr 30\n- Time: 7:30 PM/);
  assert.match(html, /<li><strong>Date:<\/strong> Thu, Apr 30<\/li><li><strong>Time:<\/strong> 7:30 PM<\/li>/);
});

test("weekly evaluated shows suppress BOTH SHOWS aggregate when nightly entries exist", () => {
  const bothShows = makeRankedEvent({
    id: "vincent-both",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman BOTH SHOWS",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman BOTH SHOWS",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/both-shows",
    date: "2026-05-01",
    time: "8:30 PM",
    score: 25,
    verdict: "Go"
  });
  const nightOne = makeRankedEvent({
    id: "vincent-night-one",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/night-one",
    date: "2026-05-01",
    time: "8:30 PM",
    score: 24,
    verdict: "Go"
  });
  const nightTwo = makeRankedEvent({
    id: "vincent-night-two",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/night-two",
    date: "2026-05-02",
    time: "8:30 PM",
    score: 23,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [bothShows, nightOne, nightTwo],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### KEXP's Roadhouse Presents: Vincent Neil Emerson w\/ Kade Hoffman/);
  assert.match(output, /- Dates: Fri, May 1, Sat, May 2/);
  assert.doesNotMatch(output, /### Friday, May 1[\s\S]*BOTH SHOWS/);
  assert.match(output, /### Friday, May 1[\s\S]*NIGHT ONE[\s\S]*Highlighted above\./);
  assert.match(output, /### Saturday, May 2[\s\S]*NIGHT TWO[\s\S]*Highlighted above\./);
});

test("weekly evaluated shows keep BOTH SHOWS listing when no nightly entries exist", () => {
  const bothShows = makeRankedEvent({
    id: "vincent-both-only",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman BOTH SHOWS",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman BOTH SHOWS",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/both-shows",
    date: "2026-05-01",
    time: "8:30 PM",
    score: 25,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [bothShows],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /### Friday, May 1[\s\S]*BOTH SHOWS[\s\S]*Highlighted above\./);
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
  const highlightsSection = output.includes("## Also Worth a Look")
    ? output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Also Worth a Look"))
    : output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Evaluated Shows by Day"));

  assert.match(highlightsSection, /### Tractor One/);
  assert.match(highlightsSection, /### Tractor Two/);
  assert.doesNotMatch(highlightsSection, /### Tractor Three/);
  assert.match(highlightsSection, /### Pat Metheny Side-Eye III\+/);
});

test("grouped multi-night strong run can beat a generic one-off weekly highlight", () => {
  const tractorOne = makeRankedEvent({
    id: "tractor-one",
    title: "Tractor One",
    artist: "Tractor One",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/tractor-one",
    date: "2026-04-26",
    score: 32,
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
    score: 31,
    verdict: "Go"
  });
  const vincentOne = makeRankedEvent({
    id: "vincent-one",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT ONE",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/vincent-one",
    date: "2026-05-01",
    score: 24,
    verdict: "Go"
  });
  const vincentTwo = makeRankedEvent({
    id: "vincent-two",
    title: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    artist: "KEXP's Roadhouse Presents: Vincent Neil Emerson w/ Kade Hoffman NIGHT TWO",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/vincent-two",
    date: "2026-05-02",
    score: 23,
    verdict: "Go"
  });
  const jazz = makeRankedEvent({
    id: "jazz",
    title: "Pat Metheny Side-Eye III+",
    artist: "Pat Metheny Side-Eye III+",
    venue: "Dimitriou's Jazz Alley",
    sourceName: "Dimitriou's Jazz Alley",
    url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=8739",
    date: "2026-04-26",
    score: 27,
    verdict: "Go"
  });
  const stg = makeRankedEvent({
    id: "stg",
    title: "Alice Phoebe Lou",
    artist: "Alice Phoebe Lou",
    venue: "The Neptune Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/alice-phoebe-lou/",
    date: "2026-04-28",
    score: 26,
    verdict: "Maybe"
  });
  const genericRoyal = makeRankedEvent({
    id: "generic-royal",
    title: "Happy Hour with Sheryl Wiser",
    artist: "Happy Hour with Sheryl Wiser",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/happy-hour-sheryl-wiser/",
    date: "2026-05-01",
    score: 18,
    verdict: "Go"
  });
  const otherOne = makeRankedEvent({
    id: "other-one",
    title: "Other One",
    artist: "Other One",
    venue: "Another Venue",
    sourceName: "Another Source",
    url: "https://example.com/other-one",
    date: "2026-04-29",
    score: 21,
    verdict: "Go"
  });
  const otherTwo = makeRankedEvent({
    id: "other-two",
    title: "Other Two",
    artist: "Other Two",
    venue: "Another Venue 2",
    sourceName: "Another Source 2",
    url: "https://example.com/other-two",
    date: "2026-04-30",
    score: 20,
    verdict: "Go"
  });
  const otherThree = makeRankedEvent({
    id: "other-three",
    title: "Other Three",
    artist: "Other Three",
    venue: "Another Venue 3",
    sourceName: "Another Source 3",
    url: "https://example.com/other-three",
    date: "2026-05-03",
    score: 19,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [tractorOne, tractorTwo, vincentOne, vincentTwo, jazz, stg, genericRoyal, otherOne, otherTwo, otherThree],
    "2026-04-26",
    "2026-05-03"
  );
  const highlightsSection = output.includes("## Also Worth a Look")
    ? output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Also Worth a Look"))
    : output.slice(output.indexOf("## This Week’s Highlights"), output.indexOf("## Evaluated Shows by Day"));

  assert.match(highlightsSection, /### KEXP's Roadhouse Presents: Vincent Neil Emerson w\/ Kade Hoffman/);
  assert.doesNotMatch(highlightsSection, /### Happy Hour with Sheryl Wiser/);
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

test("ambiguous Royal Room wording stays soft in evaluated shows", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const ambiguousRoyal = makeRankedEvent({
    id: "ambiguous-royal",
    title: "Zoë's Birthday Bash",
    artist: "Zoë's Birthday Bash",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/zoes_bday_bash/",
    date: "2026-04-27",
    score: 1,
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "Low",
      eventType: "unknown",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, ambiguousRoyal],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: unclear from listing — check details if the title interests you\./);
});

test("obvious STG non-music wording is specific", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const stgNonMusic = makeRankedEvent({
    id: "silent-movie",
    title: "Silent Movie Mondays – Faust (1926)",
    artist: "Silent Movie Mondays – Faust (1926)",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/silent-movie-mondays-faust/",
    date: "2026-04-27",
    score: -3,
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "High",
      eventType: "theater",
      fitReason: "fixture fit reason",
      exclusionReason: "non-music signals: film"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, stgNonMusic],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: theater\/ballet\/film, not this scout’s target\./);
});

test("STG workshop and audition wording is specific", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const workshop = makeRankedEvent({
    id: "stg-workshop",
    title: "DANCE This Workshop + Auditions with THE OUTSIDERS",
    artist: "DANCE This Workshop + Auditions with THE OUTSIDERS",
    venue: "Kerry Hall",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/dance-this-workshop-auditions-with-the-outsiders/",
    date: "2026-04-30",
    score: -3,
    verdict: "Skip",
    classification: {
      isLikelyMusic: false,
      musicConfidence: "High",
      eventType: "theater",
      fitReason: "fixture fit reason",
      exclusionReason: "non-music signals: workshop, audition"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, workshop],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: workshop\/audition, not this scout’s target\./);
  assert.doesNotMatch(output, /DANCE This Workshop \+ Auditions[\s\S]*maybe — check a clip first/);
});


test("weekly preview uses music-fit wording for STG music acts outside the sweet spot", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const helloween = makeRankedEvent({
    id: "helloween",
    title: "Helloween",
    artist: "Helloween",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/helloween/",
    date: "2026-04-28",
    score: 1,
    verdict: "Skip",
    genreHints: ["touring act", "larger venue", "metal"],
    classification: {
      isLikelyMusic: true,
      musicConfidence: "Medium",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, helloween],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: live music, but probably outside your usual sweet spot\./);
  assert.doesNotMatch(output, /Helloween[\s\S]*probably not a live-music fit/);
});

test("weekly preview uses softer wording for likely-music Nectar listings", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const jamMondays = makeRankedEvent({
    id: "jam-mondays",
    title: "Mo' Jam Mondays",
    artist: "Mo' Jam Mondays",
    venue: "Nectar Lounge",
    sourceName: "Nectar Lounge",
    url: "https://www.tixr.com/groups/nectarlounge/events/mo-jam-mondays-186268",
    date: "2026-04-27",
    score: 1,
    verdict: "Skip",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "Medium",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, jamMondays],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: recurring jam night — real music, but not one of the top weekly picks\./);
  assert.doesNotMatch(output, /Mo' Jam Mondays[\s\S]*probably not a live-music fit/);
});

test("weekly preview uses local-band wording for non-highlighted Skylark listings", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const skylarkListing = makeRankedEvent({
    id: "skylark-band-bill",
    title: "Swinson, The Rolling Thunder, Will Rainier & the Pines",
    artist: "Swinson, The Rolling Thunder, Will Rainier & the Pines",
    venue: "Skylark Cafe",
    sourceName: "Skylark Cafe",
    url: "https://www.skylarkcafe.com/global-events/swinson-the-rolling-thunder-will-rainier-the-pines",
    date: "2026-05-01",
    score: 1,
    verdict: "Skip",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "Medium",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, skylarkListing],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: local-band listing — check a clip first\./);
  assert.doesNotMatch(output, /Swinson, The Rolling Thunder, Will Rainier & the Pines[\s\S]*probably not a live-music fit/);
});

test("weekly preview uses mixed-format wording for Dina Martina", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-26",
    score: 30,
    verdict: "Go"
  });
  const dina = makeRankedEvent({
    id: "dina-martina",
    title: "Dina Martina",
    artist: "Dina Martina",
    venue: "The Triple Door",
    sourceName: "The Triple Door",
    url: "https://thetripledoor.net/event/6347358/744005898/dina-martina",
    date: "2026-04-29",
    score: 2,
    verdict: "Skip",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "Medium",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [highlighted, dina],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /Not highlighted: mixed-format performance — not this scout’s main music target\./);
});

test("recurring jam nights do not become weekly highlights by default", () => {
  const jamMondays = makeRankedEvent({
    id: "jam-mondays",
    title: "Mo' Jam Mondays",
    artist: "Mo' Jam Mondays",
    venue: "Nectar Lounge",
    sourceName: "Nectar Lounge",
    url: "https://www.tixr.com/groups/nectarlounge/events/mo-jam-mondays-186268",
    date: "2026-04-27",
    score: 9,
    verdict: "Go",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });
  const stronger = makeRankedEvent({
    id: "stronger",
    title: "Jessie Thoreson & The Crown Fire",
    artist: "Jessie Thoreson & The Crown Fire",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/stronger",
    date: "2026-04-30",
    score: 20,
    verdict: "Go"
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [jamMondays, stronger],
    "2026-04-26",
    "2026-05-03"
  );

  assert.doesNotMatch(output, /## This Week’s Highlights[\s\S]*### Mo' Jam Mondays/);
  assert.match(output, /Mo' Jam Mondays — Nectar Lounge[\s\S]*Not highlighted: recurring jam night — real music, but not one of the top weekly picks\./);
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

test("postponed events cannot become weekly highlights and get status-aware wording", () => {
  const strongWeeklyPick = makeRankedEvent({
    id: "stronger",
    title: "Vincent Neil Emerson",
    artist: "Vincent Neil Emerson",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/stronger",
    date: "2026-05-01",
    score: 20,
    verdict: "Go"
  });
  const postponed = makeRankedEvent({
    id: "vnv-postponed",
    title: "VNV Nation – Postponed",
    artist: "VNV Nation – Postponed",
    venue: "The Neptune Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/vnv-nation/",
    date: "2026-04-29",
    score: 18,
    verdict: "Go",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [postponed, strongWeeklyPick],
    "2026-04-26",
    "2026-05-03"
  );

  assert.doesNotMatch(output, /## This Week’s Highlights[\s\S]*### VNV Nation – Postponed/);
  assert.match(output, /VNV Nation – Postponed[\s\S]*Not highlighted: postponed\/rescheduled — check the source for current status\./);
  assert.doesNotMatch(output, /VNV Nation – Postponed[\s\S]*maybe — check a clip first/);
});

test("cancelled or rescheduled events get status-aware wording in nightly preview", () => {
  const highlighted = makeRankedEvent({
    id: "highlighted",
    title: "Clear Headliner",
    artist: "Clear Headliner",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    url: "https://www.ticketweb.com/event/highlighted",
    date: "2026-04-27",
    score: 30,
    verdict: "Go"
  });
  const cancelled = makeRankedEvent({
    id: "cancelled",
    title: "Artist Name – Cancelled",
    artist: "Artist Name – Cancelled",
    venue: "Nectar Lounge",
    sourceName: "Nectar Lounge",
    url: "https://www.tixr.com/groups/nectarlounge/events/cancelled",
    date: "2026-04-27",
    score: 12,
    verdict: "Maybe",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });
  const rescheduled = makeRankedEvent({
    id: "rescheduled",
    title: "Artist Name – Rescheduled",
    artist: "Artist Name – Rescheduled",
    venue: "Skylark Cafe",
    sourceName: "Skylark Cafe",
    url: "https://www.skylarkcafe.com/global-events/rescheduled",
    date: "2026-04-27",
    score: 12,
    verdict: "Go",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateEmailPreview(
    new Date("2026-04-27T18:00:00-07:00"),
    [highlighted, cancelled, rescheduled]
  );

  assert.doesNotMatch(output, /## Tonight’s Highlights[\s\S]*### Artist Name – Cancelled/);
  assert.doesNotMatch(output, /## Tonight’s Highlights[\s\S]*### Artist Name – Rescheduled/);
  assert.match(output, /Artist Name – Cancelled[\s\S]*Not highlighted: postponed\/rescheduled — check the source for current status\./);
  assert.match(output, /Artist Name – Rescheduled[\s\S]*Not highlighted: postponed\/rescheduled — check the source for current status\./);
});

test("valid events stay highlight-eligible even if description mentions a past reschedule", () => {
  const valid = makeRankedEvent({
    id: "valid-event",
    title: "Normal Tour Stop",
    artist: "Normal Tour Stop",
    venue: "The Neptune Theatre",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/normal-tour-stop/",
    date: "2026-04-29",
    score: 18,
    verdict: "Go",
    description: "Originally rescheduled from last year, now confirmed for April 29.",
    classification: {
      isLikelyMusic: true,
      musicConfidence: "High",
      eventType: "music",
      fitReason: "fixture fit reason"
    }
  });

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-26T12:00:00-07:00"),
    [valid],
    "2026-04-26",
    "2026-05-03"
  );

  assert.match(output, /## This Week’s Highlights[\s\S]*### Normal Tour Stop/);
  assert.doesNotMatch(output, /postponed\/rescheduled — check the source for current status/);
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
