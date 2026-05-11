import test from "node:test";
import assert from "node:assert/strict";

import { parseRoyalRoom } from "../src/parsers/royalRoom.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "The Royal Room",
  url: "https://theroyalroomseattle.com/events/",
  parser: "royalRoom",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Columbia City"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-05-11T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

test("parseRoyalRoom uses trailing Free listing text as ticket price text", () => {
  const result = parseRoyalRoom(
    `
      <a href="/event/happy-hour-trio/">
        15 May 15 May Happy Hour Trio Friday, May 15, 2026 @ 04:00 PM - Free
      </a>
    `,
    CONTEXT
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "Happy Hour Trio");
  assert.equal(result.events[0].ticketPriceText, "Free");
});

test("parseRoyalRoom ignores Free in titles when listing tail is not free admission", () => {
  const result = parseRoyalRoom(
    `
      <a href="/event/free-jazz-workshop/">
        16 May 16 May Free Jazz Workshop Saturday, May 16, 2026 @ 08:00 PM
      </a>
    `,
    CONTEXT
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "Free Jazz Workshop");
  assert.equal(result.events[0].ticketPriceText, undefined);
});
