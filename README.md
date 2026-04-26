# Live Music Scout

Live Music Scout is a local TypeScript CLI that checks a curated set of Seattle-area venue pages, extracts candidate events for tonight, ranks them against your preferences, and either prints a markdown email preview or sends that same body as a manual email.

For product direction and next-step planning, see [ROADMAP.md](/Users/edwardtremblay/Library/CloudStorage/OneDrive-Personal/vibe coding/live music scout/ROADMAP.md).

This MVP is intentionally narrow:

- local command only
- no scheduler yet
- manual email sending only
- source-specific parsers with graceful fallbacks
- easy to extend venue-by-venue

## Quick start

```bash
npm install
npm run scout
```

## Commands

Preview mode:

```bash
npm run scout
```

Manual email mode:

```bash
npm run scout:email
```

## What the script does

`npm run scout` will:

1. Load venue sources from `data/sources.json`
2. Load preferences from `data/preferences.json`
3. Load already-seen events from `data/seen-events.json`
4. Fetch each venue page
5. Parse candidate events using source-specific parsers
6. Keep only events that appear to be happening tonight in the Seattle timezone
7. Rank matches against your preferences
8. Print a markdown email preview
9. Persist newly seen event IDs so future runs can avoid obvious duplicates

`npm run scout:email` runs the same pipeline, prints the same preview and parser summary, and then sends the preview as a plain-text email through SMTP.

## Current parser coverage

- `Tractor Tavern`: implemented
- `The Royal Room`: implemented
- `STG Presents`: implemented first-pass parser
- `Sunset Tavern`: fetch validated, parser still TODO
- `Dimitriou's Jazz Alley`: TODO
- `Nectar Lounge`: TODO
- `SeaMonster Lounge`: TODO
- `Easy Street Records`: TODO

The implemented parser is intentionally conservative. If the date cannot be determined confidently, the event is not promoted to a top recommendation.

## Project structure

```text
src/
  index.ts
  types.ts
  config.ts
  fetchPage.ts
  dateUtils.ts
  rankEvents.ts
  generateEmail.ts
  storage.ts
  parsers/
    index.ts
    stg.ts
    tractor.ts
    sunset.ts
    royalRoom.ts
    jazzAlley.ts
    nectar.ts
    seaMonster.ts
    easyStreet.ts
data/
  sources.json
  preferences.json
  seen-events.json
```

## Notes for extending parsers

- Add source-specific parsing logic in `src/parsers/<source>.ts`
- Return conservative confidence when genre or timing is inferred from weak text
- Prefer skipping uncertain events rather than inventing details
- Keep parser failures isolated so one bad source never breaks the run

## Environment

Preview mode does not require any secrets.

Manual email mode requires a local `.env` or `.env.local` file with:

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASS=your_google_app_password
EMAIL_FROM=Live Music Scout <your_gmail_address@gmail.com>
EMAIL_TO=your_email@example.com
```

Recommended setup:

1. Copy `.env.example` to `.env.local`
2. Fill in your SMTP settings and sender/recipient addresses
3. Run `npm run scout:email`

If those variables are missing, `npm run scout:email` fails gracefully and tells you exactly which env vars are missing.

## Gmail SMTP setup

For a simple local setup, Gmail SMTP is the recommended option:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=your Gmail address`
- `SMTP_PASS=your Google App Password`

Important:

- Gmail SMTP requires 2-Step Verification on your Google account
- `SMTP_PASS` must be a Google App Password, not your normal Gmail password
- Keep secrets in `.env.local`
- Never commit `.env.local`, `.env`, or any real credentials
