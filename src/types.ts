export type Confidence = "High" | "Medium" | "Low";
export type Verdict = "Go" | "Maybe" | "Skip";
export type ReportKind = "tonight" | "week";

export type LiveMusicEvent = {
  id: string;
  title: string;
  artist?: string;
  venue: string;
  date: string;
  time?: string;
  location?: string;
  url: string;
  sourceName: string;
  genreHints: string[];
  description?: string;
  confidence: Confidence;
  basis: string;
};

export type RankedEvent = LiveMusicEvent & {
  classification: EventClassification;
  score: number;
  verdict: Verdict;
  matchReasons: string[];
  isSeen: boolean;
};

export type EventClassification = {
  isLikelyMusic: boolean;
  musicConfidence: Confidence;
  eventType: "music" | "comedy" | "talk" | "theater" | "dance" | "unknown";
  fitReason: string;
  exclusionReason?: string;
};

export type ClassifiedEvent = LiveMusicEvent & {
  classification: EventClassification;
};

export type SourceConfig = {
  name: string;
  url: string;
  parser: string;
  location?: string;
  areaTags?: string[];
  sourceType?: "venue" | "promoter" | "seasonal" | "seasonal_outdoor" | "large_venue";
  musicOnly?: boolean;
  seasonal?: boolean;
  duplicateGroup?: string;
  coveredVenues?: string[];
  parserStatus?: "live" | "todo";
  notes?: string;
};

export type Preferences = {
  homeBase: string;
  targetAreas: string[];
  preferredGenres: string[];
  avoidGenres: string[];
  venuePreferences: string[];
  avoidSignals: string[];
};

export type SeenEventsStore = {
  seenEventIds: string[];
};

export type FetchStatus = "fetched" | "skipped" | "failed";

export type SourceRunStatus = {
  sourceName: string;
  parserName: string;
  ok: boolean;
  fetchStatus: FetchStatus;
  message: string;
  candidateCount: number;
  matchedCount: number;
  matchedLabel: string;
  parserConfidence?: Confidence;
  uncertainCount?: number;
  likelyMusicCount?: number;
  excludedCount?: number;
  ambiguousCount?: number;
};

export type ParserContext = {
  source: SourceConfig;
  now: Date;
  timezone: string;
};

export type ParserResult = {
  events: LiveMusicEvent[];
  statusMessage: string;
  candidateCount?: number;
  uncertainCount?: number;
  parserConfidence?: Confidence;
};

export type SourceParser = (html: string, context: ParserContext) => Promise<ParserResult> | ParserResult;
