import type { ParserContext, ParserResult } from "../types.js";

export function parseEasyStreet(html: string, _context: ParserContext): ParserResult {
  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      html.includes("JavaScript is disabled")
        ? "parser TODO: Easy Street Records events page is JS-gated and anti-bot protected in the first-pass fetch path"
        : "parser TODO: Easy Street Records events page appears JS-gated, so the first-pass parser intentionally skips it."
  };
}
