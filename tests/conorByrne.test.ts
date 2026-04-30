import test from "node:test";
import assert from "node:assert/strict";

import {
  extractConorByrneVenuePilotConfig,
  isClearlySkippedConorByrneEvent,
  normalizeConorByrneVenuePilotEvent
} from "../src/parsers/conorByrne.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "Conor Byrne Pub",
  url: "https://www.conorbyrnepub.com/#/events",
  parser: "conorByrne",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Ballard"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-29T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

test("extractConorByrneVenuePilotConfig reads public VenuePilot settings from the events page", () => {
  const html = `
    <div id="venuepilot-app"></div>
    <script type='text/javascript'>
      window.venuepilotSettings = {
        general: {
          accountIds: [194],
          server: 'https://www.venuepilot.co/',
          routing: 'hash',
        },
        widgets: {}
      }
    </script>
  `;

  assert.deepEqual(extractConorByrneVenuePilotConfig(html), {
    accountIds: [194],
    server: "https://www.venuepilot.co/"
  });
});

test("normalizeConorByrneVenuePilotEvent maps public VenuePilot events to scout events", () => {
  const event = normalizeConorByrneVenuePilotEvent({
    id: 166862,
    name: "Moonlight Remedy + Victor Artis + Good Enough",
    date: "2026-04-30",
    startTime: "20:00:00",
    minimumAge: 21,
    status: "Tickets",
    venue: {
      name: "Conor Byrne Cooperative"
    },
    description: "<p>Live at Conor Byrne Pub in Ballard.</p>",
    ticketsUrl: "https://www.conorbyrnepub.com/#/events/166862"
  }, CONTEXT);

  assert.ok(event);
  assert.equal(event.title, "Moonlight Remedy + Victor Artis + Good Enough");
  assert.equal(event.venue, "Conor Byrne Pub");
  assert.equal(event.date, "2026-04-30");
  assert.equal(event.time, "8:00 PM");
  assert.equal(event.location, "5140 Ballard Ave NW, Seattle, WA 98107");
  assert.equal(event.sourceName, "Conor Byrne Pub");
  assert.equal(event.genreHints.includes("live music"), true);
  assert.equal(event.genreHints.includes("Ballard club"), true);
  assert.match(event.description ?? "", /Live at Conor Byrne Pub/);
  assert.match(event.basis, /public VenuePilot event widget/);
});

test("isClearlySkippedConorByrneEvent filters obvious lesson-only listings without dropping songwriter nights", () => {
  assert.equal(isClearlySkippedConorByrneEvent({
    name: "Free Lindy Hop Lessons!",
    date: "2026-05-04"
  }), true);

  assert.equal(isClearlySkippedConorByrneEvent({
    name: "Sunday Song Share",
    date: "2026-05-03"
  }), false);
});
