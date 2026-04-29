import type { ParserContext, ParserResult } from "../types.js";

export function parseEasyStreet(html: string, _context: ParserContext): ParserResult {
  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      html.includes("CloudFront") || html.includes("403 ERROR") || html.includes("Request blocked")
        ? "parser TODO: Easy Street Records official events page returned CloudFront 403 in the first-pass fetch path; no reliable public parser source is configured"
        : "parser TODO: Easy Street Records events page does not expose reliable first-pass public event data, so the parser intentionally skips it."
  };
}
