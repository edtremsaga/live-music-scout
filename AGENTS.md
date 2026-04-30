# Live Music Scout Agent Instructions

## Scope

These instructions apply to the Live Music Scout repository. Follow the existing app patterns and keep changes small, focused, and easy to verify.

## Venue Parser Safety Rules

Venue parser work is limited to public event-data parsing. Use only event data that is available through normal public page loading, static HTML, embedded structured data, documented public feeds, or clearly referenced public event widgets.

When describing or planning venue parser work, use public-content wording:

- "Inspect the public events page."
- "Check whether event listings are present in static HTML, JSON-LD, RSS/ICS, or a documented public feed."
- "Parse the public event rows/cards/feed."
- "Leave the source as TODO if the public page is blocked, gated, or too brittle."

Avoid security-sensitive wording for ordinary venue work. Do not describe tasks as request capture, endpoint discovery, API discovery, network reconnaissance, probing, enumeration, bypassing protections, reverse engineering, or traffic inspection. If the only way to get data would require those methods, stop and report that no safe public parser path is available.

Do not:

- Bypass access controls, login walls, Cloudflare or bot protections, rate limits, blocked resources, or other access restrictions.
- Use credentials, session cookies, private tokens, personal accounts, or authenticated browser state.
- Scan, probe, fuzz, enumerate, or map infrastructure.
- Frame or execute venue tasks as network request capture, endpoint discovery, reconnaissance, private API discovery, or reverse engineering of protected services.
- Add aggressive retries, browser automation, or stealth behavior to obtain venue data.

If a source is blocked, gated, brittle, or not reliably available from public event data, leave it as a parser TODO and explain the limitation honestly.

## Preferred Venue Workflow

1. Feasibility inspect public event source.
   - Check the configured public URL.
   - Determine whether event data is available in static HTML, embedded structured data, a documented public feed, or a clearly referenced public event widget.
   - Report whether a parser can be implemented safely and reliably.

2. Implement parser only if the public source is reliable.
   - Normalize events into the existing Live Music Scout event shape.
   - Add focused deterministic tests using fixtures or representative public samples.
   - Update source status only when the parser actually feeds normalized events.
   - Do not change ranking, email formatting, source fetching, or unrelated parsers unless the task explicitly asks for it.

## Verification

Standard safe verification commands:

```sh
npm test
npm run typecheck
npm run scout
npm run scout:week
```

Do not run real email-sending commands unless explicitly asked. This includes:

```sh
npm run scout:email
npm run scout:week:email
npm run scout:verify
npm run scout:week:verify
```

The verification-report commands may email real reports depending on configuration, so treat them as email-sending commands.

## Worktree Notes

The worktree may contain user or previous-agent changes. Do not revert unrelated changes. Before editing, check status and keep documentation-only tasks limited to documentation files.
