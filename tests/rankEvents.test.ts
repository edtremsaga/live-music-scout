import test from "node:test";
import assert from "node:assert/strict";

import { classifyEvents } from "../src/classifyEvents.js";
import { generateWeeklyEmailPreview } from "../src/generateEmail.js";
import { rankEvents } from "../src/rankEvents.js";
import type { LiveMusicEvent, Preferences } from "../src/types.js";

const preferences: Preferences = {
  homeBase: "Bellevue, WA",
  targetAreas: ["Seattle", "Bellevue"],
  preferredGenres: ["rock", "Americana", "funk", "soul", "jazz", "jam", "singer-songwriter"],
  avoidGenres: ["EDM", "DJ", "metal", "hardcore"],
  venuePreferences: ["seated or comfortable venues", "strong local musicianship"],
  avoidSignals: ["very late"]
};

function makeEvent(overrides: Partial<LiveMusicEvent>): LiveMusicEvent {
  return {
    id: "test-event",
    title: "Test Event",
    artist: "Test Event",
    venue: "The Royal Room",
    date: "2026-05-01",
    time: "7:30 PM",
    location: "5000 Rainier Avenue S, Seattle, WA 98118",
    url: "https://theroyalroomseattle.com/event/test-event/",
    sourceName: "The Royal Room",
    genreHints: [],
    confidence: "High",
    basis: "fixture basis",
    ...overrides
  };
}

test("album release outranks vague benefit concert in weekly ranking", () => {
  const somDaMassa = makeEvent({
    id: "som-da-massa",
    title: "Som da Massa Album Release",
    artist: "Som da Massa Album Release",
    date: "2026-05-03",
    url: "https://theroyalroomseattle.com/event/somdamassa/"
  });
  const benefit = makeEvent({
    id: "the-work",
    title: "“The Work” A May Day Benefit Concert for OneAmerica",
    artist: "“The Work” A May Day Benefit Concert for OneAmerica",
    date: "2026-05-01",
    url: "https://theroyalroomseattle.com/event/the-work-a-may-day-benefit-concert-for-oneamerica/"
  });

  const ranked = rankEvents(classifyEvents([benefit, somDaMassa]), preferences, new Set());
  const somDaMassaRank = ranked.findIndex((event) => event.id === "som-da-massa");
  const benefitRank = ranked.findIndex((event) => event.id === "the-work");

  assert.ok(somDaMassaRank >= 0);
  assert.ok(benefitRank >= 0);
  assert.ok(somDaMassaRank < benefitRank);
  assert.ok((ranked.find((event) => event.id === "som-da-massa")?.matchReasons ?? []).some((reason) => reason.includes("release-show")));
  assert.ok((ranked.find((event) => event.id === "the-work")?.matchReasons ?? []).some((reason) => reason.includes("light on artist detail")));
});

test("weekly highlights put album release ahead of vague benefit concert", () => {
  const ranked = rankEvents(
    classifyEvents([
      makeEvent({
        id: "the-work",
        title: "“The Work” A May Day Benefit Concert for OneAmerica",
        artist: "“The Work” A May Day Benefit Concert for OneAmerica",
        date: "2026-05-01",
        url: "https://theroyalroomseattle.com/event/the-work-a-may-day-benefit-concert-for-oneamerica/"
      }),
      makeEvent({
        id: "som-da-massa",
        title: "Som da Massa Album Release",
        artist: "Som da Massa Album Release",
        date: "2026-05-03",
        url: "https://theroyalroomseattle.com/event/somdamassa/"
      })
    ]),
    preferences,
    new Set()
  );

  const output = generateWeeklyEmailPreview(
    new Date("2026-04-28T12:00:00-07:00"),
    ranked,
    "2026-04-28",
    "2026-05-05"
  );

  assert.ok(output.indexOf("### Som da Massa Album Release") < output.indexOf("### “The Work” A May Day Benefit Concert for OneAmerica"));
});
