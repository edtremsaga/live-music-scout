import test from "node:test";
import assert from "node:assert/strict";

import { generateEmailHtml, generateEmailPreview, getSourceLinkLabel } from "../src/generateEmail.js";
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

test("display text decodes HTML entities without changing URLs", () => {
  const decodedTitleEvent = makeRankedEvent({
    title: "Brazilian Showcase &#038; Solstice Parade Launch",
    artist: "Brazilian Showcase &#038; Solstice Parade Launch",
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
  assert.match(output, /Brazilian Showcase & Solstice Parade Launch/);
  assert.match(output, /\[Royal Room event page\]\(https:\/\/theroyalroomseattle\.com\/event\/brazilianshowase\/\?foo=bar&baz=qux\)/);
});
