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

test("Mo' Jam Mondays classifies as music rather than non-music", () => {
  const event = makeEvent({
    title: "Mo' Jam Mondays",
    venue: "Nectar Lounge",
    sourceName: "Nectar Lounge",
    url: "https://www.tixr.com/groups/nectarlounge/events/mo-jam-mondays-186268"
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});

test("Helloween classifies as music rather than non-music", () => {
  const event = makeEvent({
    title: "Helloween",
    venue: "The Paramount Theatre",
    sourceName: "STG Presents",
    genreHints: ["touring act", "larger venue"],
    url: "https://www.stgpresents.org/events/helloween/"
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});

test("Skylark multi-band listing classifies as music", () => {
  const event = makeEvent({
    title: "Swinson, The Rolling Thunder, Will Rainier & the Pines",
    venue: "Skylark Cafe",
    sourceName: "Skylark Cafe",
    url: "https://www.skylarkcafe.com/global-events/swinson-the-rolling-thunder-will-rainier-the-pines"
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});

test("Kerry Hall yoga/class style STG listing stays out of likely music", () => {
  const event = makeEvent({
    title: "Yoga en Español con Karla Mora Repeating Event",
    venue: "Kerry Hall",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/yoga-en-espanol-con-karla-mora-spring-2026/"
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, false);
});
