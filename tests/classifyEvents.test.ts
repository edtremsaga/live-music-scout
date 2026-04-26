import test from "node:test";
import assert from "node:assert/strict";

import { classifyEvent } from "../src/classifyEvents.js";
import type { LiveMusicEvent } from "../src/types.js";

function makeEvent(overrides: Partial<LiveMusicEvent>): LiveMusicEvent {
  return {
    id: "test-event",
    title: "Test Event",
    venue: "Test Venue",
    date: "2026-04-24",
    url: "https://example.com",
    sourceName: "Test Source",
    genreHints: [],
    confidence: "Medium",
    basis: "fixture",
    ...overrides
  };
}

test("Damien Jurado classifies as likely music", () => {
  const event = makeEvent({
    title: "KEXP Presents: Damien Jurado w/ St. Yuma (Album Release), Ray Wolff",
    venue: "Tractor Tavern",
    sourceName: "Tractor Tavern",
    genreHints: ["Americana", "rock", "singer-songwriter"]
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});

test("Jonathan Van Ness stays out of likely music", () => {
  const event = makeEvent({
    title: "Jonathan Van Ness",
    venue: "The Moore Theatre",
    sourceName: "STG Presents",
    genreHints: []
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, false);
});

test("Joe Casalini Trio classifies as music", () => {
  const event = makeEvent({
    title: "The Joe Casalini Trio",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    genreHints: ["local musicianship"]
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.musicConfidence, "High");
});

test("Electric Callboy remains at least ambiguous rather than obvious non-music", () => {
  const event = makeEvent({
    title: "Electric Callboy",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    genreHints: []
  });

  const classified = classifyEvent(event);
  assert.notEqual(classified.classification.eventType, "comedy");
  assert.notEqual(classified.classification.eventType, "talk");
});

test("Drew and Ellie Holcomb classifies as music", () => {
  const event = makeEvent({
    title: "Drew and Ellie Holcomb",
    venue: "The Neptune Theatre",
    sourceName: "STG Presents",
    genreHints: ["folk", "singer-songwriter"]
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
});
