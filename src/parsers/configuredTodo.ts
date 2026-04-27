import type { ParserContext, ParserResult } from "../types.js";

export function parseConfiguredTodoSource(_html: string, context: ParserContext): ParserResult {
  const sourceType = context.source.sourceType ? `${context.source.sourceType} source` : "configured source";
  const musicOnlyText = context.source.musicOnly ? "music-only filtering intended" : "broader filtering rules still TBD";
  const seasonalText = context.source.seasonal ? "seasonal availability likely applies" : undefined;

  return {
    events: [],
    candidateCount: 0,
    parserConfidence: "Low",
    statusMessage: [
      context.source.notes ?? "parser TODO: source is configured but a reliable parser is not implemented yet",
      sourceType,
      musicOnlyText,
      seasonalText
    ]
      .filter(Boolean)
      .join("; ")
  };
}
