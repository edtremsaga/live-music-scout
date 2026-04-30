import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SourceConfig } from "../src/types.js";

function loadSources(): SourceConfig[] {
  const filePath = resolve(process.cwd(), "data/sources.json");
  return JSON.parse(readFileSync(filePath, "utf8")) as SourceConfig[];
}

test("configured allowlist includes the new venue and seasonal sources", () => {
  const sources = loadSources();
  const names = new Set(sources.map((source) => source.name));

  assert.equal(names.has("Hidden Hall"), true);
  assert.equal(names.has("Bake's Place"), true);
  assert.equal(names.has("The Triple Door"), true);
  assert.equal(names.has("Skylark Cafe"), true);
  assert.equal(names.has("Tim's Tavern"), true);
  assert.equal(names.has("El Corazon"), true);
  assert.equal(names.has("Slim's Last Chance"), true);
  assert.equal(names.has("Remlinger Farms Summer Concerts"), true);
  assert.equal(names.has("Marymoor Park Concerts"), true);
  assert.equal(names.has("Chateau Ste. Michelle Summer Concerts"), true);
  assert.equal(names.has("Woodland Park Zoo / ZooTunes"), true);
  assert.equal(names.has("The Gorge Amphitheatre Summer Concerts"), true);
  assert.equal(names.has("Climate Pledge Arena"), true);
});

test("The Triple Door is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const tripleDoor = sources.find((source) => source.name === "The Triple Door");

  assert.ok(tripleDoor);
  assert.equal(tripleDoor.parser, "tripleDoor");
  assert.equal(tripleDoor.parserStatus, "live");
  assert.equal(tripleDoor.musicOnly, true);
});

test("Bake's Place is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const bakesPlace = sources.find((source) => source.name === "Bake's Place");

  assert.ok(bakesPlace);
  assert.equal(bakesPlace.parser, "bakesPlace");
  assert.equal(bakesPlace.parserStatus, "live");
  assert.equal(bakesPlace.musicOnly, true);
});

test("Sunset Tavern is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const sunset = sources.find((source) => source.name === "Sunset Tavern");

  assert.ok(sunset);
  assert.equal(sunset.parser, "sunset");
  assert.equal(sunset.parserStatus, "live");
  assert.equal(sunset.musicOnly, true);
  assert.match(sunset.notes ?? "", /DICE event widget/i);
});

test("Nectar Lounge, Hidden Hall, and Skylark Cafe are configured as live parsed venue sources", () => {
  const sources = loadSources();
  const nectar = sources.find((source) => source.name === "Nectar Lounge");
  const hiddenHall = sources.find((source) => source.name === "Hidden Hall");
  const skylark = sources.find((source) => source.name === "Skylark Cafe");

  assert.ok(nectar);
  assert.equal(nectar.parser, "nectar");
  assert.equal(nectar.parserStatus, "live");
  assert.equal(nectar.musicOnly, true);

  assert.ok(hiddenHall);
  assert.equal(hiddenHall.parser, "hiddenHall");
  assert.equal(hiddenHall.parserStatus, "live");
  assert.equal(hiddenHall.musicOnly, true);

  assert.ok(skylark);
  assert.equal(skylark.parser, "skylark");
  assert.equal(skylark.parserStatus, "live");
  assert.equal(skylark.musicOnly, true);
});

test("Tim's Tavern is configured as an honest TODO live-music venue source", () => {
  const sources = loadSources();
  const timsTavern = sources.find((source) => source.name === "Tim's Tavern");

  assert.ok(timsTavern);
  assert.equal(timsTavern.parser, "configuredTodo");
  assert.equal(timsTavern.parserStatus, "todo");
  assert.equal(timsTavern.sourceType, "venue");
  assert.equal(timsTavern.musicOnly, true);
  assert.match(timsTavern.notes ?? "", /Cloudflare challenge/i);
});

test("SeaMonster Lounge is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const seaMonster = sources.find((source) => source.name === "SeaMonster Lounge");

  assert.ok(seaMonster);
  assert.equal(seaMonster.url, "https://www.seamonsterlounge.com/");
  assert.equal(seaMonster.parser, "seaMonster");
  assert.equal(seaMonster.parserStatus, "live");
  assert.equal(seaMonster.sourceType, "venue");
  assert.equal(seaMonster.musicOnly, true);
  assert.match(seaMonster.notes ?? "", /official public Wix Events listings/i);
});

test("El Corazon is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const elCorazon = sources.find((source) => source.name === "El Corazon");

  assert.ok(elCorazon);
  assert.equal(elCorazon.parser, "elCorazon");
  assert.equal(elCorazon.parserStatus, "live");
  assert.equal(elCorazon.sourceType, "venue");
  assert.equal(elCorazon.musicOnly, true);
  assert.match(elCorazon.notes ?? "", /public Webflow event cards/i);
});

test("Slim's Last Chance is configured as a live parsed venue source", () => {
  const sources = loadSources();
  const slims = sources.find((source) => source.name === "Slim's Last Chance");

  assert.ok(slims);
  assert.equal(slims.url, "https://www.slimslastchance.com/shows");
  assert.equal(slims.parser, "slims");
  assert.equal(slims.parserStatus, "live");
  assert.equal(slims.sourceType, "venue");
  assert.equal(slims.musicOnly, true);
  assert.equal(slims.areaTags?.includes("Georgetown"), true);
  assert.match(slims.notes ?? "", /public VenuePilot event widget/i);
});

test("STG stays a promoter source and absorbs Neptune and Moore coverage without duplicate sources", () => {
  const sources = loadSources();
  const stg = sources.find((source) => source.name === "STG Presents");

  assert.ok(stg);
  assert.equal(stg.sourceType, "promoter");
  assert.equal(stg.musicOnly, true);
  assert.equal(stg.coveredVenues?.includes("The Neptune Theatre"), true);
  assert.equal(stg.coveredVenues?.includes("The Moore Theatre"), true);
  assert.equal(stg.coveredVenues?.includes("Remlinger Farms"), true);

  assert.equal(sources.some((source) => source.name === "Neptune Theatre"), false);
  assert.equal(sources.some((source) => source.name === "Moore Theatre"), false);
});

test("KEXP Events is configured as a live public event source", () => {
  const sources = loadSources();
  const kexp = sources.find((source) => source.name === "KEXP Events");

  assert.ok(kexp);
  assert.equal(kexp.url, "https://www.kexp.org/events/");
  assert.equal(kexp.parser, "kexp");
  assert.equal(kexp.parserStatus, "live");
  assert.equal(kexp.sourceType, "promoter");
  assert.equal(kexp.musicOnly, true);
  assert.equal(kexp.coveredVenues?.includes("KEXP Studio (NW Rooms)"), true);
  assert.match(kexp.notes ?? "", /public KEXP event rows/i);
});

test("remaining outdoor summer concert TODO source is consistently marked", () => {
  const sources = loadSources();
  const remlinger = sources.find((source) => source.name === "Remlinger Farms Summer Concerts");
  const climatePledge = sources.find((source) => source.name === "Climate Pledge Arena");

  assert.ok(remlinger);
  assert.equal(remlinger.sourceType, "seasonal_outdoor");
  assert.equal(remlinger.seasonal, true);
  assert.equal(remlinger.musicOnly, true);
  assert.equal(remlinger.duplicateGroup, "remlinger-farms");
  assert.equal(remlinger.parserStatus, "todo");

  assert.ok(climatePledge);
  assert.equal(climatePledge.sourceType, "large_venue");
  assert.equal(climatePledge.musicOnly, true);
  assert.equal(climatePledge.parserStatus, "todo");
});

test("Chateau Ste. Michelle Summer Concerts is configured as a live seasonal outdoor source", () => {
  const sources = loadSources();
  const chateau = sources.find((source) => source.name === "Chateau Ste. Michelle Summer Concerts");

  assert.ok(chateau);
  assert.equal(chateau.url, "https://www.ste-michelle.com/visit-us/summer-concerts");
  assert.equal(chateau.parser, "chateauSteMichelle");
  assert.equal(chateau.sourceType, "seasonal_outdoor");
  assert.equal(chateau.seasonal, true);
  assert.equal(chateau.musicOnly, true);
  assert.equal(chateau.parserStatus, "live");
  assert.match(chateau.notes ?? "", /public static event rows/i);
});

test("Marymoor Park Concerts is configured as a live seasonal outdoor source", () => {
  const sources = loadSources();
  const marymoor = sources.find((source) => source.name === "Marymoor Park Concerts");

  assert.ok(marymoor);
  assert.equal(marymoor.url, "https://www.marymoorlive.com/");
  assert.equal(marymoor.parser, "marymoor");
  assert.equal(marymoor.sourceType, "seasonal_outdoor");
  assert.equal(marymoor.seasonal, true);
  assert.equal(marymoor.musicOnly, true);
  assert.equal(marymoor.parserStatus, "live");
  assert.match(marymoor.notes ?? "", /public static event rows/i);
});

test("Woodland Park Zoo / ZooTunes is configured as a live seasonal outdoor source", () => {
  const sources = loadSources();
  const zootunes = sources.find((source) => source.name === "Woodland Park Zoo / ZooTunes");

  assert.ok(zootunes);
  assert.equal(zootunes.url, "https://www.zoo.org/zootunes");
  assert.equal(zootunes.parser, "zooTunes");
  assert.equal(zootunes.sourceType, "seasonal_outdoor");
  assert.equal(zootunes.seasonal, true);
  assert.equal(zootunes.musicOnly, true);
  assert.equal(zootunes.parserStatus, "live");
  assert.match(zootunes.notes ?? "", /public static concert blocks/i);
});

test("The Gorge Amphitheatre Summer Concerts is tracked as a seasonal outdoor TODO source", () => {
  const sources = loadSources();
  const gorge = sources.find((source) => source.name === "The Gorge Amphitheatre Summer Concerts");

  assert.ok(gorge);
  assert.equal(gorge.url, "https://www.gorgeamphitheatre.com/shows");
  assert.equal(gorge.parser, "configuredTodo");
  assert.equal(gorge.sourceType, "seasonal_outdoor");
  assert.equal(gorge.seasonal, true);
  assert.equal(gorge.musicOnly, true);
  assert.equal(gorge.parserStatus, "todo");
  assert.equal(gorge.areaTags?.includes("Central Washington"), true);
  assert.match(gorge.notes ?? "", /official Gorge Amphitheatre \/ Live Nation public pages/i);
  assert.match(gorge.notes ?? "", /loading shells/i);
});
