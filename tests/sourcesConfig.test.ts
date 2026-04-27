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
  assert.equal(names.has("Remlinger Farms Summer Concerts"), true);
  assert.equal(names.has("Marymoor Park Concerts"), true);
  assert.equal(names.has("Chateau Ste. Michelle Summer Concerts"), true);
  assert.equal(names.has("Woodland Park Zoo / ZooTunes"), true);
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

test("outdoor summer concert sources are consistently marked as configured TODO entries", () => {
  const sources = loadSources();
  const remlinger = sources.find((source) => source.name === "Remlinger Farms Summer Concerts");
  const marymoor = sources.find((source) => source.name === "Marymoor Park Concerts");
  const chateau = sources.find((source) => source.name === "Chateau Ste. Michelle Summer Concerts");
  const zootunes = sources.find((source) => source.name === "Woodland Park Zoo / ZooTunes");
  const climatePledge = sources.find((source) => source.name === "Climate Pledge Arena");

  assert.ok(remlinger);
  assert.equal(remlinger.sourceType, "seasonal_outdoor");
  assert.equal(remlinger.seasonal, true);
  assert.equal(remlinger.musicOnly, true);
  assert.equal(remlinger.duplicateGroup, "remlinger-farms");
  assert.equal(remlinger.parserStatus, "todo");

  assert.ok(marymoor);
  assert.equal(marymoor.sourceType, "seasonal_outdoor");
  assert.equal(marymoor.seasonal, true);
  assert.equal(marymoor.musicOnly, true);
  assert.equal(marymoor.parserStatus, "todo");

  assert.ok(chateau);
  assert.equal(chateau.sourceType, "seasonal_outdoor");
  assert.equal(chateau.seasonal, true);
  assert.equal(chateau.musicOnly, true);
  assert.equal(chateau.parserStatus, "todo");

  assert.ok(zootunes);
  assert.equal(zootunes.sourceType, "seasonal_outdoor");
  assert.equal(zootunes.seasonal, true);
  assert.equal(zootunes.musicOnly, true);
  assert.equal(zootunes.parserStatus, "todo");

  assert.ok(climatePledge);
  assert.equal(climatePledge.sourceType, "large_venue");
  assert.equal(climatePledge.musicOnly, true);
  assert.equal(climatePledge.parserStatus, "todo");
});
