import type { ParserContext, ParserResult } from "../types.js";

export function parseJazzAlley(_html: string, _context: ParserContext): ParserResult {
  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      "parser TODO: Jazz Alley source is difficult to normalize from the current page. Add a dedicated parser when structure is mapped."
  };
}
