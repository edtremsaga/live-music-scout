import test from "node:test";
import assert from "node:assert/strict";

import { extractSeaMonsterListings, parseSeaMonster } from "../src/parsers/seaMonster.js";
import type { ParserContext, SourceConfig } from "../src/types.js";

const SOURCE: SourceConfig = {
  name: "SeaMonster Lounge",
  url: "https://www.seamonsterlounge.com/",
  parser: "seaMonster",
  location: "Seattle, WA",
  areaTags: ["Seattle", "Wallingford"],
  sourceType: "venue",
  musicOnly: true,
  parserStatus: "live"
};

const CONTEXT: ParserContext = {
  source: SOURCE,
  now: new Date("2026-04-29T12:00:00-07:00"),
  timezone: "America/Los_Angeles"
};

function makeFixtureHtml(): string {
  const warmupData = {
    appsWarmupData: {
      "140603ad-af8d-84a5-2c80-a0f60cb47351": {
        "widgetcomp-kx2nxyph": {
          events: {
            events: [
              {
                id: "cf7ec744-7b00-42eb-b7ed-076c892aef58",
                title: "Suffering Yuckheads",
                slug: "suffering-yuckheads-2026-04-29-19-30",
                status: 0,
                description: "Seattle’s oddball organ/drum duo mixes punk rock sensibility with improvisational tactics.",
                location: {
                  name: "Sea Monster Lounge",
                  address: "2202 N 45th St, Seattle, WA 98103, USA"
                },
                scheduling: {
                  config: {
                    startDate: "2026-04-30T02:30:00.000Z",
                    endDate: "2026-04-30T04:00:00.000Z",
                    timeZoneId: "America/Los_Angeles"
                  },
                  startTimeFormatted: "7:30 PM"
                }
              },
              {
                id: "97ebbc11-76d2-4e60-ac6c-14f33d1147ae",
                title: "Super Krewe",
                slug: "super-krewe-4",
                description: "Seattle brass ensemble fusing NOLA street-band tradition with originals and curated classics.",
                location: {
                  fullAddress: {
                    formattedAddress: "2202 N 45th St, Seattle, WA 98103, USA"
                  }
                },
                scheduling: {
                  config: {
                    startDate: "2026-04-30T05:00:00.000Z",
                    endDate: "2026-04-30T08:00:00.000Z",
                    timeZoneId: "America/Los_Angeles"
                  },
                  startTimeFormatted: "10:00 PM"
                }
              }
            ]
          }
        }
      }
    }
  };

  return `
    <html>
      <body>
        <script type="application/json" id="wix-warmup-data">${JSON.stringify(warmupData)}</script>
      </body>
    </html>
  `;
}

test("extractSeaMonsterListings reads official public Wix Events warmup data", () => {
  const listings = extractSeaMonsterListings(makeFixtureHtml(), CONTEXT);

  assert.equal(listings.length, 2);
  assert.equal(listings[0].title, "Suffering Yuckheads");
  assert.equal(listings[0].date, "2026-04-29");
  assert.equal(listings[0].time, "7:30 PM");
  assert.equal(listings[0].location, "2202 N 45th St, Seattle, WA 98103, USA");
  assert.equal(
    listings[0].url,
    "https://www.seamonsterlounge.com/event-info/suffering-yuckheads-2026-04-29-19-30"
  );
  assert.match(listings[0].description ?? "", /organ\/drum duo/);
});

test("parseSeaMonster normalizes public SeaMonster listings into scout events", () => {
  const result = parseSeaMonster(makeFixtureHtml(), CONTEXT);

  assert.equal(result.events.length, 2);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.parserConfidence, "High");
  assert.match(result.statusMessage, /official public Wix Events listings/);
  assert.equal(result.events[1].title, "Super Krewe");
  assert.equal(result.events[1].venue, "SeaMonster Lounge");
  assert.equal(result.events[1].sourceName, "SeaMonster Lounge");
  assert.equal(result.events[1].date, "2026-04-29");
  assert.equal(result.events[1].time, "10:00 PM");
  assert.equal(result.events[1].genreHints.includes("jazz"), true);
  assert.equal(result.events[1].genreHints.includes("brass"), true);
  assert.match(result.events[1].basis, /official public Wix Events listings/);
});
