import type { ParserContext, ParserResult } from "../types.js";

export function parseSunset(html: string, _context: ParserContext): ParserResult {
  const looksImageOnly = html.includes("# Live Music") || html.includes("See All Shows");

  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      looksImageOnly
        ? "parser TODO: Sunset Tavern fetched successfully, but the shows page appears image-heavy and does not expose reliable event text in server-rendered HTML"
        : "parser TODO: Sunset Tavern calendar needs source-specific parsing"
  };
}
