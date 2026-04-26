import type { ParserContext, ParserResult } from "../types.js";

export function parseSeaMonster(_html: string, _context: ParserContext): ParserResult {
  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage:
      "parser TODO: SeaMonster Lounge calendar parser is pending page-structure review."
  };
}
