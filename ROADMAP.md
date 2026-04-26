# Live Music Scout Roadmap

## Product Summary

Live Music Scout is a personal live-music discovery agent for the Seattle/Bellevue area.

Its core job is:

> Help me quickly see which live music events are worth considering, without manually checking a bunch of venue calendars.

The app should act like a curated personal scout, not a generic event database.

It should not claim to show every live music event in Seattle. It only reports on shows/events evaluated from configured venue sources.

## Current v1 Status

The app currently works end-to-end as a local CLI.

Current commands:

```bash
npm run scout
npm run scout:email
```

### `npm run scout`

Preview mode.

It:
- fetches configured venue sources,
- parses tonight’s events,
- classifies/ranks them,
- generates a friendly email-style brief,
- prints the brief in the terminal,
- prints parser/debug status separately.

### `npm run scout:email`

Manual email mode.

It:
- runs the same scout pipeline,
- generates the same report,
- sends the report through Gmail SMTP,
- prints the parser/debug summary in the terminal.

Gmail SMTP is used instead of Resend because the user does not currently have a custom email domain.

Secrets should live only in `.env.local`.

Do not hard-code real email addresses, app passwords, or other secrets into source files.

## Current Email Structure

The public-facing email currently uses this structure:

Subject: Live Music Scout — Tonight around Seattle/Bellevue

Date: [date]

## Tonight’s Highlights
[Top highlighted shows]

## All Evaluated Shows
[Other evaluated events for tonight]

Evaluated from the configured venue sources; not a complete citywide calendar.

## Current Public Email Tone

The email should feel warm, useful, and shareable.

Preferred public-facing labels:

- `Why it looks good`
- `My take`
- `Source`

Avoid clinical or algorithmic public-facing language such as:

- `Confidence`
- `Basis`
- `parsed from`
- `strong music signals`
- `classification confidence`
- `parser confidence`
- `venue fit suggests`
- `live-band odds`

Technical confidence, parser status, and classification details may remain in terminal/debug output, but should not clutter the public email body.

## Current Link and Text Handling

The email should use friendly source labels rather than raw intimidating URLs.

Examples:

- `Tractor/TicketWeb listing`
- `Royal Room event page`
- `STG event page`
- `Event page`

HTML email output should use clickable links.

Plain-text/markdown output should use readable markdown links.

Displayed public text should decode common HTML entities, such as:

- `&#038;` and `&amp;` → `&`
- `&quot;` → `"`
- `&#39;` → `'`
- `&nbsp;` → regular space

Do not alter actual URLs during display cleanup.

## Product Principles

1. Do not claim complete citywide coverage.
2. Use configured venue sources only.
3. Keep the public tone warm, useful, and shareable.
4. Highlights first, then evaluated shows.
5. Sold-out shows may still be highlighted if musically useful, but availability must be clear.
6. Preserve manual/on-demand use.
7. Build in small slices.
8. Do not build the console too early.

## Sold-Out Event Policy

Sold-out shows can still be useful.

A sold-out event may appear in highlights if it is otherwise a strong musical fit.

However:
- show `Availability: Sold out`,
- do not say simply `Go if tickets are available`,
- use wording such as:

My take: Worth tracking, but it’s sold out — check resale or future dates.

## v1.1 — Weekly Planning Mode

The next major feature should be weekly planning mode.

Goal:

> Help me plan live music for the coming week, likely from a Monday afternoon report.

New commands should likely be:

```bash
npm run scout:week
npm run scout:week:email
```

### `npm run scout:week`

Preview the next 7 days of live music without sending email.

### `npm run scout:week:email`

Generate and email the next 7 days of live music using the existing Gmail SMTP setup.

### Weekly Report Structure

Suggested weekly email structure:

Subject: Live Music Scout — This Week around Seattle/Bellevue

Date range: [start date] – [end date]

## This Week’s Highlights
[Top 3–8 highlights across the week]

## Evaluated Shows by Day

### Monday
[shows]

### Tuesday
[shows]

...

Evaluated from the configured venue sources; not a complete citywide calendar.

### Weekly Mode Requirements

Weekly mode should:
- preserve the existing tonight report,
- not break `npm run scout`,
- not break `npm run scout:email`,
- evaluate events from today through the next 7 days,
- group evaluated events by day,
- show highlights first,
- use the same warm public tone,
- use friendly links,
- preserve HTML email output and plain-text fallback,
- keep parser/debug status separate from public email content.

## v1.2 — Scheduling

After weekly mode works manually, add scheduling.

Likely first scheduled job:

> Every Monday afternoon, send the weekly live music planning report.

Scheduling should come after manual weekly reports are useful.

Possible scheduling options:
- macOS LaunchAgent,
- cron,
- GitHub Actions scheduled workflow,
- hosted scheduler later if the app becomes deployed.

Daily/on-demand mode should remain available even after scheduling is added.

## Source Coverage Improvements

Future parser/source work may include:

- better Jazz Alley support,
- better SeaMonster source URL/feed,
- better Sunset Tavern support if a reliable data source exists,
- better Nectar Lounge support,
- better Easy Street support if practical,
- stronger STG music-vs-non-music classification,
- additional Seattle/Eastside venues.

Do not overbuild source coverage before the report format and weekly planning mode prove useful.

## Later v2 — Private Console

A later version may add a small private console.

The console should not be built yet.

Possible console features:
- run a tonight report on demand,
- run a weekly report on demand,
- preview before sending,
- send to self,
- send to selected friends/family,
- manage recipients and email addresses,
- manage venues,
- manage preferred genres,
- manage lower-priority genres,
- manage schedules,
- view recent reports.

The console should make the app easier to control without editing JSON files.

## Future Sharing Use Case

The app may eventually be shared with friends or family.

Because of that, public-facing copy should avoid sounding overly personalized only to Ed when possible.

Prefer language that works for a small group of music-interested recipients.

Examples:
- `Why it looks good`
- `My take`
- `This one looks worth a listen`
- `Probably not this scout’s kind of night`

Avoid overusing:
- `Why it might fit Ed`

## Build Order

Recommended build order:

1. Current v1: manual tonight report and manual email send.
2. v1.1: weekly report preview and weekly report email.
3. v1.2: scheduled Monday weekly report.
4. Source coverage improvements.
5. Private console.
6. Recipient/friend management.
7. More advanced personalization.

## Important Reminder

Do not turn Live Music Scout into a generic event search product.

The value is curation:

> A small, trusted, configurable scout that helps decide what live music is worth considering.
