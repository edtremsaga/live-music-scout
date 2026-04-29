import test from "node:test";
import assert from "node:assert/strict";

import { parseSunset, sunsetParserTestExports } from "../src/parsers/sunset.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "Sunset Tavern",
  url: "https://sunsettavern.com/shows/",
  parser: "sunset",
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

const SAMPLE_HTML = `
<div id="dice-event-list-widget"></div>
<script src="https://widgets.dice.fm/dice-event-list-widget.js" type="text/javascript"></script>
<script type="text/javascript">
DiceEventListWidget.create({"apiKey":"public-test-key","promoters":["Bars We Like, Inc dba Sunset Tavern"],"layout":"gallery"});
</script>
`;

const SAMPLE_DICE_EVENT = {
  id: "699385afd5ca2d0001a68870",
  name: "Tractor Tavern Presents: Anna Tivel, Sam Weber",
  date: "2026-05-01T03:00:00Z",
  timezone: "America/Los_Angeles",
  venue: "The Sunset Tavern",
  address: "5433 Ballard Avenue Northwest, Seattle, Washington 98107, United States",
  url: "https://link.dice.fm/c4608a577b5b",
  raw_description: "**Advance: $20**\n\nPresented by Tractor Tavern",
  artists: ["Anna Tivel"],
  genre_tags: ["gig:folk"],
  type_tags: ["music:gig"],
  flags: ["going_ahead"],
  status: "on-sale",
  lineup: [
    { details: "Doors open", time: "7:30 PM" },
    { details: "Sam Weber", time: "8:00 PM" },
    { details: "Anna Tivel", time: "" }
  ]
};

test("extractDiceWidgetConfig reads the public DICE widget configuration from Sunset HTML", () => {
  const config = sunsetParserTestExports.extractDiceWidgetConfig(SAMPLE_HTML);

  assert.deepEqual(config, {
    apiKey: "public-test-key",
    promoters: ["Bars We Like, Inc dba Sunset Tavern"]
  });
});

test("normalizeDiceEvent maps Sunset DICE payloads to Live Music Scout events", () => {
  const event = sunsetParserTestExports.normalizeDiceEvent(SAMPLE_DICE_EVENT, CONTEXT);

  assert.ok(event);
  assert.equal(event.title, "Tractor Tavern Presents: Anna Tivel, Sam Weber");
  assert.equal(event.venue, "Sunset Tavern");
  assert.equal(event.date, "2026-04-30");
  assert.equal(event.time, "8:00 PM");
  assert.equal(event.location, "5433 Ballard Avenue Northwest, Seattle, Washington 98107, United States");
  assert.equal(event.url, "https://link.dice.fm/c4608a577b5b");
  assert.equal(event.sourceName, "Sunset Tavern");
  assert.equal(event.artist, "Anna Tivel");
  assert.equal(event.genreHints.includes("folk"), true);
  assert.match(event.description ?? "", /Advance: \$20/);
});

test("parseSunset fetches the public DICE endpoint and prevents duplicate event output", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input));
    assert.equal((init?.headers as Record<string, string>)["x-api-key"], "public-test-key");

    return new Response(JSON.stringify({
      data: [SAMPLE_DICE_EVENT, SAMPLE_DICE_EVENT]
    }), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  };

  try {
    const result = await parseSunset(SAMPLE_HTML, CONTEXT);

    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /partners-endpoint\.dice\.fm\/api\/v2\/events/);
    assert.match(requestedUrls[0], /filter%5Bpromoters%5D%5B%5D=Bars\+We\+Like/);
    assert.equal(result.events.length, 1);
    assert.equal(result.candidateCount, 2);
    assert.equal(result.parserConfidence, "High");
    assert.match(result.statusMessage, /parsed Sunset Tavern events/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
