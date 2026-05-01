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

test("Neumos, Barboza, Chop Suey, and Conor Byrne club listings classify as music", () => {
  const neumos = classifyEvent(makeEvent({
    title: "Grace Ives",
    venue: "Neumos",
    sourceName: "Neumos",
    genreHints: ["live music", "Capitol Hill club", "touring act"],
    url: "https://www.neumos.com/events/detail/grace-ives-tickets-1341247"
  }));
  const barboza = classifyEvent(makeEvent({
    title: "Daniel Romano's Outfit",
    venue: "Barboza",
    sourceName: "Barboza",
    genreHints: ["live music", "Capitol Hill club", "supporting artists"],
    url: "https://www.thebarboza.com/events/detail/daniel-romanos-outfit-tickets-1352175"
  }));
  const chopSuey = classifyEvent(makeEvent({
    title: "Beautiful Freaks, Universe, Casino Youth, Fatal Femmes, Nerve Rot",
    venue: "Chop Suey",
    sourceName: "Chop Suey",
    genreHints: ["live music", "Capitol Hill club"],
    url: "https://chopsuey.com/tm-event/beautiful-freaks/"
  }));
  const conorByrne = classifyEvent(makeEvent({
    title: "Moonlight Remedy + Victor Artis + Good Enough",
    venue: "Conor Byrne Pub",
    sourceName: "Conor Byrne Pub",
    genreHints: ["live music", "Ballard club"],
    url: "https://www.conorbyrnepub.com/#/events/166862"
  }));

  assert.equal(neumos.classification.isLikelyMusic, true);
  assert.equal(neumos.classification.eventType, "music");
  assert.equal(barboza.classification.isLikelyMusic, true);
  assert.equal(barboza.classification.eventType, "music");
  assert.equal(chopSuey.classification.isLikelyMusic, true);
  assert.equal(chopSuey.classification.eventType, "music");
  assert.equal(conorByrne.classification.isLikelyMusic, true);
  assert.equal(conorByrne.classification.eventType, "music");
  assert.equal(conorByrne.classification.musicConfidence, "High");
});

test("The Crocodile complex listings classify as music when parsed from included rooms", () => {
  const crocodile = classifyEvent(makeEvent({
    title: "Moonchild, Brittney Carter",
    venue: "The Crocodile",
    sourceName: "The Crocodile",
    genreHints: ["live music", "Belltown club", "supporting artists"],
    url: "https://www.ticketweb.com/event/moonchild-the-crocodile-tickets/1"
  }));
  const madameLous = classifyEvent(makeEvent({
    title: "Ground Zero Blues Club",
    venue: "Madame Lou's",
    sourceName: "The Crocodile",
    genreHints: ["live music", "Belltown club", "blues"],
    url: "https://www.ticketweb.com/event/ground-zero-madame-lous-tickets/2"
  }));

  assert.equal(crocodile.classification.isLikelyMusic, true);
  assert.equal(crocodile.classification.eventType, "music");
  assert.equal(madameLous.classification.isLikelyMusic, true);
  assert.equal(madameLous.classification.eventType, "music");
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

test("Kerry Hall workshop and audition STG listing stays out of likely music", () => {
  const event = makeEvent({
    title: "DANCE This Workshop + Auditions with THE OUTSIDERS",
    venue: "Kerry Hall",
    sourceName: "STG Presents",
    url: "https://www.stgpresents.org/events/dance-this-workshop-auditions-with-the-outsiders/"
  });

  const classified = classifyEvent(event);
  assert.equal(classified.classification.isLikelyMusic, false);
  assert.equal(classified.classification.eventType, "theater");
  assert.match(classified.classification.exclusionReason ?? "", /workshop/);
});

test("KEXP public in-person event rows classify as music", () => {
  const classified = classifyEvent(makeEvent({
    title: "Diana Ratsamee of Eastern Echoes at The Laserdome",
    venue: "Laser Dome at Pacific Science Center",
    sourceName: "KEXP Events",
    genreHints: ["concert", "live music", "KEXP public event"],
    url: "https://www.kexp.org/events/kexp-events/diana-ratsamee-of-eastern-echoes-at-the-laserdome/"
  }));

  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});

test("Climate Pledge Ticketmaster MusicEvent rows classify as music", () => {
  const classified = classifyEvent(makeEvent({
    title: "Florence + The Machine",
    venue: "Climate Pledge Arena",
    sourceName: "Climate Pledge Arena",
    genreHints: ["large arena concert", "Ticketmaster MusicEvent", "touring act"],
    url: "https://www.ticketmaster.com/florence-the-machine-seattle-washington-05-12-2026/event/0F0062E2"
  }));

  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
  assert.equal(classified.classification.musicConfidence, "High");
  assert.match(classified.classification.fitReason, /strong music signals/);
});

test("Royal Room specific music-looking titles classify as likely music", () => {
  const titles = [
    "Stillhouse Junkies",
    "The Nate Omdal Septet plays the Music from “Star Wars”",
    "Songtellers Circle: Queer Musical Magic & Medicine"
  ];

  for (const title of titles) {
    const classified = classifyEvent(makeEvent({
      title,
      venue: "The Royal Room",
      sourceName: "The Royal Room",
      url: `https://theroyalroomseattle.com/event/${title.toLowerCase().replace(/\W+/g, "-")}/`
    }));

    assert.equal(classified.classification.isLikelyMusic, true, title);
  }
});

test("Royal Room benefit concert remains plausible music", () => {
  const classified = classifyEvent(makeEvent({
    title: "“The Work” A May Day Benefit Concert for OneAmerica",
    venue: "The Royal Room",
    sourceName: "The Royal Room",
    url: "https://theroyalroomseattle.com/event/the-work-a-may-day-benefit-concert-for-oneamerica/"
  }));

  assert.equal(classified.classification.isLikelyMusic, true);
  assert.equal(classified.classification.eventType, "music");
});
