const PACIFIC_TIMEZONE = "America/Los_Angeles";

function getParts(date: Date, timezone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function getPacificTimezone(): string {
  return PACIFIC_TIMEZONE;
}

export function getTonightKey(now: Date, timezone = PACIFIC_TIMEZONE): string {
  const parts = getParts(now, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDateKeyWithOffset(now: Date, offsetDays: number, timezone = PACIFIC_TIMEZONE): string {
  const shifted = new Date(now);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);
  return getTonightKey(shifted, timezone);
}

export function isDateInRange(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

export function formatDateKeyLong(dateKey: string, timezone = PACIFIC_TIMEZONE): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return formatTonightLong(date, timezone);
}

export function formatDateRangeLong(startKey: string, endKey: string, timezone = PACIFIC_TIMEZONE): string {
  return `${formatDateKeyLong(startKey, timezone)} – ${formatDateKeyLong(endKey, timezone)}`;
}

export function formatDateKeyWeekday(dateKey: string, timezone = PACIFIC_TIMEZONE): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function formatDateKeyShort(dateKey: string, timezone = PACIFIC_TIMEZONE): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function formatTonightLong(now: Date, timezone = PACIFIC_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(now);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#038;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, "\"")
    .replace(/&rdquo;/g, "\"")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8220;/g, "\"")
    .replace(/&#8221;/g, "\"");
}

export function cleanDisplayText(value: string | undefined): string {
  return normalizeWhitespace(decodeHtmlEntities(value ?? ""));
}

export function stripHtml(html: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

export function getTextLines(html: string): string[] {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6|tr|td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

  return text
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

export function parseMonthDayText(
  value: string,
  now: Date,
  timezone = PACIFIC_TIMEZONE
): string | undefined {
  const cleaned = value
    .replace(/\./g, "")
    .replace(/,+/g, "")
    .trim();
  const match = cleaned.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:\s+(\d{4}))?\b/i
  );

  if (!match) {
    return undefined;
  }

  const [, monthText, dayText, explicitYear] = match;
  const current = getParts(now, timezone);
  const year = explicitYear ?? current.year;
  const candidate = new Date(`${monthText} ${dayText} ${year} 12:00:00`);

  if (Number.isNaN(candidate.getTime())) {
    return undefined;
  }

  const parts = getParts(candidate, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isTonight(dateText: string | undefined, now: Date, timezone = PACIFIC_TIMEZONE): boolean {
  if (!dateText) {
    return false;
  }

  return dateText === getTonightKey(now, timezone);
}

export function extractTime(value: string): string | undefined {
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*([AP]M)\b/i);
  if (!match) {
    return undefined;
  }

  const [, hour, minute, meridiem] = match;
  return `${hour}:${minute ?? "00"} ${meridiem.toUpperCase()}`;
}

export function getTimeOfDayNote(time: string | undefined): string | undefined {
  if (!time) {
    return undefined;
  }

  const match = time.match(/^(\d{1,2}):(\d{2})\s([AP]M)$/i);
  if (!match) {
    return undefined;
  }

  const [, hourText, , meridiem] = match;
  let hour = Number.parseInt(hourText, 10);

  if (meridiem.toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  if (hour < 18) {
    return "Earlier show — better if you want an afternoon/early evening option.";
  }

  if (hour >= 21) {
    return "Later show — only a good fit if you are up for a later night.";
  }

  return undefined;
}
