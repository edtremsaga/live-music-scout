import test from "node:test";
import assert from "node:assert/strict";

import {
  extractSlimsSiteAssetUrls,
  extractSlimsTicketingEmbedUrls,
  extractVenuePilotConfig,
  extractVenuePilotWidgetUrl,
  isClearlySkippedSlimsEvent,
  normalizeSlimsVenuePilotEvent
} from "../src/parsers/slims.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "Slim's Last Chance",
  url: "https://www.slimslastchance.com/shows",
  parser: "slims",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Georgetown"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-29T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

test("extractSlimsSiteAssetUrls finds public Wix page assets from the shows page", () => {
  const html = `
    <script>
      window.__assets = "https://siteassets.parastorage.com/pages/pages/thunderbolt?pageId=shows&amp;siteRevision=29";
      window.__duplicate = "https://siteassets.parastorage.com/pages/pages/thunderbolt?pageId=shows&amp;siteRevision=29";
    </script>
  `;

  assert.deepEqual(extractSlimsSiteAssetUrls(html), [
    "https://siteassets.parastorage.com/pages/pages/thunderbolt?pageId=shows&siteRevision=29"
  ]);
});

test("extractSlimsTicketingEmbedUrls finds the public VenuePilot embed from Wix page JSON", () => {
  const pageAssetJson = JSON.stringify({
    props: {
      render: {
        compProps: {
          ticketing: {
            title: "Ticketing",
            url: "https://www-slimslastchance-com.filesusr.com/html/7b4491_cf5ad66932d2a8b0025395c1d22fba3b.html"
          }
        }
      }
    }
  });

  assert.deepEqual(extractSlimsTicketingEmbedUrls(pageAssetJson), [
    "https://www-slimslastchance-com.filesusr.com/html/7b4491_cf5ad66932d2a8b0025395c1d22fba3b.html"
  ]);
});

test("extractVenuePilotWidgetUrl reads the public widget script from the embed", () => {
  const embedHtml = `
    <div id="venuepilot-app"></div>
    <div id="eventGridElementId1"></div>
    <script src="https://www.venuepilot.co/widgets/oDzzKBTtCbtT9CzQNQj8.js"></script>
  `;

  assert.equal(
    extractVenuePilotWidgetUrl(embedHtml),
    "https://www.venuepilot.co/widgets/oDzzKBTtCbtT9CzQNQj8.js"
  );
});

test("extractVenuePilotConfig reads account IDs and server from the public widget", () => {
  const widgetJs = `
    window.venuepilotSettings = {
      "general": {
        "accountIds": [3482],
        "server": "https://www.venuepilot.co/",
        "displayTime": "door"
      },
      "widgets": {}
    };

    let styleEl = document.createElement('style');
  `;

  assert.deepEqual(extractVenuePilotConfig(widgetJs), {
    accountIds: [3482],
    server: "https://www.venuepilot.co/"
  });
});

test("normalizeSlimsVenuePilotEvent maps public VenuePilot events to scout events", () => {
  const event = normalizeSlimsVenuePilotEvent({
    id: 180040,
    name: "Bones Creek // Crashsite // Rand Cufley",
    date: "2026-04-30",
    doorTime: "18:00:00",
    startTime: "19:00:00",
    minimumAge: 21,
    status: "Tickets",
    venue: {
      name: "Slim's Last Chance"
    },
    description: "<p>Thursday April 30th we have Bones Creek // Crashsite // Rand Cufley at Slim’s Last Chance.</p>",
    ticketsUrl: "https://tickets.venuepilot.com/e/crash-site-bones-creek-rand-cufley-2026-04-30-slim-s-last-chance-seattle-9077ba"
  }, CONTEXT);

  assert.ok(event);
  assert.equal(event.title, "Bones Creek // Crashsite // Rand Cufley");
  assert.equal(event.venue, "Slim's Last Chance");
  assert.equal(event.date, "2026-04-30");
  assert.equal(event.time, "7:00 PM");
  assert.equal(event.location, "5606 1st Ave S, Seattle, WA 98108");
  assert.equal(event.sourceName, "Slim's Last Chance");
  assert.equal(event.genreHints.includes("live music"), true);
  assert.equal(event.genreHints.includes("Georgetown club"), true);
  assert.match(event.description ?? "", /Thursday April 30th/);
  assert.match(event.basis, /public VenuePilot event widget/);
});

test("isClearlySkippedSlimsEvent filters obvious non-music events without dropping live band karaoke", () => {
  assert.equal(isClearlySkippedSlimsEvent({
    name: "Vintage Motorcycle Enthusiasts Meetup",
    date: "2026-05-06"
  }), true);

  assert.equal(isClearlySkippedSlimsEvent({
    name: "Live Band Karaoke - Dylan Lost",
    date: "2026-05-05"
  }), false);
});
