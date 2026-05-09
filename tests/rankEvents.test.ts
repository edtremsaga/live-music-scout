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

test("known seated Jazz Alley acts outrank generic late-night venue-confidence picks", () => {
  const ranked = rankEvents(
    classifyEvents([
      makeEvent({
        id: "generic-seamonster",
        title: "700 Funk",
        artist: "700 Funk",
        venue: "SeaMonster Lounge",
        date: "2026-05-09",
        time: "10:00 PM",
        location: "2202 N 45th St, Seattle, WA 98103",
        url: "https://www.seamonsterlounge.com/events/700-funk",
        sourceName: "SeaMonster Lounge",
        genreHints: ["live music", "concert", "funk", "soul", "jazz", "jam", "SeaMonster Lounge"]
      }),
      makeEvent({
        id: "spyro-gyra",
        title: "Spyro Gyra",
        artist: "Spyro Gyra",
        venue: "Dimitriou's Jazz Alley",
        date: "2026-05-09",
        time: "7:30 PM",
        location: "2033 6th Ave, Seattle, WA 98121",
        url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=1234",
        sourceName: "Dimitriou's Jazz Alley",
        genreHints: ["jazz"]
      })
    ]),
    preferences,
    new Set()
  );

  const spyro = ranked.find((event) => event.id === "spyro-gyra");
  const genericSeaMonster = ranked.find((event) => event.id === "generic-seamonster");

  assert.ok(spyro);
  assert.ok(genericSeaMonster);
  assert.ok(spyro.score > genericSeaMonster.score);
  assert.equal(genericSeaMonster.score, 14);
  assert.ok(spyro.matchReasons.some((reason) => reason.includes("known act signal")));
  assert.ok(spyro.matchReasons.some((reason) => reason.includes("seated-quality")));
  assert.ok(genericSeaMonster.matchReasons.some((reason) => reason.includes("capped")));
});

test("known recurring regular shows are capped without penalizing special SeaMonster events", () => {
  const ranked = rankEvents(
    classifyEvents([
      makeEvent({
        id: "ron-weinstein-trio",
        title: "Ron Weinstein Trio",
        artist: "Ron Weinstein Trio",
        venue: "SeaMonster Lounge",
        date: "2026-05-10",
        time: "9:00 PM",
        location: "2202 N 45th St, Seattle, WA 98103",
        url: "https://www.seamonsterlounge.com/events/ron-weinstein-trio",
        sourceName: "SeaMonster Lounge",
        genreHints: ["live music", "concert", "jazz", "funk", "soul", "jam", "SeaMonster Lounge"]
      }),
      makeEvent({
        id: "seamonster-special",
        title: "New Record Release w/ Local Quartet",
        artist: "New Record Release w/ Local Quartet",
        venue: "SeaMonster Lounge",
        date: "2026-05-10",
        time: "9:00 PM",
        location: "2202 N 45th St, Seattle, WA 98103",
        url: "https://www.seamonsterlounge.com/events/new-record-release",
        sourceName: "SeaMonster Lounge",
        genreHints: ["live music", "concert", "jazz", "funk", "soul", "jam", "SeaMonster Lounge"]
      })
    ]),
    preferences,
    new Set()
  );

  const regular = ranked.find((event) => event.id === "ron-weinstein-trio");
  const special = ranked.find((event) => event.id === "seamonster-special");

  assert.ok(regular);
  assert.ok(special);
  assert.equal(regular.score, 14);
  assert.ok(special.score > regular.score);
  assert.ok(regular.matchReasons.some((reason) => reason.includes("recurring regular show cap")));
  assert.ok(!special.matchReasons.some((reason) => reason.includes("recurring regular show cap")));
});

test("Bake's Place gets an explicit Eastside convenience boost", () => {
  const ranked = rankEvents(
    classifyEvents([
      makeEvent({
        id: "bakes-tribute",
        title: "LuckyTown: A High-Octane Tribute to The Boss",
        artist: "LuckyTown",
        venue: "Bake's Place",
        date: "2026-05-09",
        time: "6:00 PM",
        location: "155 108th Avenue Northeast Ste. 110, Bellevue, WA 98004",
        url: "https://bakesplacebellevue.com/event/luckytown/",
        sourceName: "Bake's Place",
        genreHints: ["tribute", "rock", "live music"]
      })
    ]),
    preferences,
    new Set()
  );

  assert.ok(ranked[0].matchReasons.some((reason) => reason.includes("Eastside convenience")));
});

test("known Showbox acts can compete without boosting every Showbox event equally", () => {
  const ranked = rankEvents(
    classifyEvents([
      makeEvent({
        id: "echo",
        title: "Echo & The Bunnymen",
        artist: "Echo & The Bunnymen",
        venue: "Showbox SoDo",
        date: "2026-05-12",
        time: "8:00 PM",
        location: "1700 1st Ave S, Seattle, WA 98134",
        url: "https://www.showboxpresents.com/events/detail/1183923",
        sourceName: "Showbox Presents",
        genreHints: ["rock", "concert", "touring act", "Showbox SoDo"]
      }),
      makeEvent({
        id: "generic-showbox",
        title: "Good Kid",
        artist: "Good Kid",
        venue: "Showbox SoDo",
        date: "2026-05-09",
        time: "8:00 PM",
        location: "1700 1st Ave S, Seattle, WA 98134",
        url: "https://www.showboxpresents.com/events/detail/1237576",
        sourceName: "Showbox Presents",
        genreHints: ["rock", "concert", "touring act", "Showbox SoDo"]
      }),
      makeEvent({
        id: "spyro-gyra",
        title: "Spyro Gyra",
        artist: "Spyro Gyra",
        venue: "Dimitriou's Jazz Alley",
        date: "2026-05-09",
        time: "7:30 PM",
        location: "2033 6th Ave, Seattle, WA 98121",
        url: "https://www.jazzalley.com/www-home/artist.jsp?shownum=1234",
        sourceName: "Dimitriou's Jazz Alley",
        genreHints: ["jazz"]
      })
    ]),
    preferences,
    new Set()
  );

  const echo = ranked.find((event) => event.id === "echo");
  const genericShowbox = ranked.find((event) => event.id === "generic-showbox");
  const spyro = ranked.find((event) => event.id === "spyro-gyra");

  assert.ok(echo);
  assert.ok(genericShowbox);
  assert.ok(spyro);
  assert.ok(echo.score > genericShowbox.score);
  assert.ok(echo.score > spyro.score);
  assert.ok(echo.matchReasons.some((reason) => reason.includes("tier 1 personal-favorite known act signal")));
  assert.ok(spyro.matchReasons.some((reason) => reason.includes("tier 3 friend-shareable known act signal")));
  assert.ok(echo.matchReasons.some((reason) => reason.includes("strong personal taste signal: rock")));
  assert.ok(echo.matchReasons.some((reason) => reason.includes("Showbox is a high-signal")));
  assert.ok(genericShowbox.matchReasons.some((reason) => reason.includes("Showbox is a high-signal")));
  assert.ok(!genericShowbox.matchReasons.some((reason) => reason.includes("known act")));
});
