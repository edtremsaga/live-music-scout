import type { ParserContext, ParserResult } from "../types.js";

export function parseNectar(html: string, _context: ParserContext): ParserResult {
  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      html.includes("[eb_listview")
        ? "parser TODO: Nectar Lounge page appears to rely on an embedded event widget shortcode rather than stable server-rendered listings"
        : "parser TODO: Nectar Lounge page appears to rely on embedded event widgets. Add a dedicated parser or alternate feed lookup."
  };
}
