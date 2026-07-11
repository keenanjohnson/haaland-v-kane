# CLAUDE.md — Haaland vs Kane Impact-o-meter

Project memory for Claude Code. Read README.md first for the concept.

## Mission & deadline

Joke website for the Norway vs England World Cup quarter-final, **kickoff tonight 10pm BST (5pm EDT), 11 July 2026**. Priorities in order:

1. **Never look broken.** Simulation mode is the default and the fallback for every failure path (no key, API error, rate-limited, stat missing).
2. **Funny beats accurate.** Comedy timing > data completeness.
3. **Ship fast.** No frameworks, no build step. One `index.html`, one serverless function. Resist adding dependencies.
4. Mobile friendly. Most users will be on mobile, so make sure that is the best version.

## Tech decisions (already made — don't relitigate)

- Plain HTML/CSS/JS frontend, single file where practical.
- Vercel serverless function at `/api/match.js` is the ONLY thing that talks to Sportmonks. It holds `SPORTMONKS_TOKEN` (env var), caches responses in memory ~15s, and returns a trimmed JSON shape the frontend consumes.
- **The Sportmonks token must NEVER appear in client-side code, git history, or config.js.** This site will be shared publicly.
- Frontend polls `/api/match` every 20–30s. No websockets, no streaming.

## Sportmonks API notes (v3)

- Base: `https://api.sportmonks.com/v3/football`
- Auth: `Authorization: <token>` header.
- Key endpoints:
  - `GET /livescores/inplay` — matches currently in play.
  - `GET /fixtures/{id}?include=events;statistics;lineups.details;participants` — one call can return events, match stats and player-level stats. Check the docs for exact include names; `?include=` eager-loads relations.
  - Fixture ID for Norway vs England: find it via the fixtures-by-date endpoint for 2026-07-11 and hardcode it in `config.js` before kickoff.
- Player/team stats come back as `{ type_id, value }` pairs. Decode type IDs against the reference: https://docs.sportmonks.com/v3/definitions/types/statistics (e.g. 86 = Shots On Target; there is a "Touches" type — look up its ID there, do not guess it).
- Rate limits: ~3000 calls per entity per hour on paid plans; 429 = over limit. With server-side caching at 15s we're nowhere near it.
- Trial/plan: World Cup 2026 package; paid plans include a one-time 14-day trial.

## Data fallbacks (important)

Player-level in-play stats (especially touches) are NOT guaranteed to populate live for this tournament — verify against a real live match before trusting them (France vs Spain plays earlier today; use it as a test target).

Degradation ladder — implement so each level silently falls back to the next:

1. Live player stats available → real touches/passes/shots/duels per striker.
2. Only match events available → derive goals/assists/cards per player from events; label touches as "estimated (few)" — this is part of the joke, keep it.
3. Only scoreline available → gauges driven by goals + match minute only.
4. Nothing available → SIMULATION mode.

## The gauges (comedy spec)

- Impact score = heavily goal-weighted. Suggested: `goals*70 + assists*20 + shots_on_target*5 + touches*0.1`, clamp 0–100. Tune for comedy, not fairness.
- Gauge zones, low→high: `DORMANT → LURKING → INVOLVED → DANGEROUS → VIKING` (Haaland) / `... → IT'S COMING HOME` (Kane). If Norway lead, Kane's gauge label "IT'S COMING HOME" gets a strikethrough.
- If match phase = penalties, both gauges catch fire (CSS animation).
- Ticker lines are template-generated from events. Tone: deadpan Norwegian understatement for Haaland, mounting English anxiety for Kane. Keep a pool of ~20 templates per striker so repeats are rare.
- Easter egg: after any Norway goal, show a one-line Lillelien-1981-style exclamation (rotate through a pre-written set; reference the style, don't reproduce the original commentary).

## Style

- Boxing tale-of-the-tape poster: big condensed display type, Haaland side in Norway red (#BA0C2F) + navy (#00205B), Kane side in white/St George red (#C8102E). Dark background, gold accents for the gauges.
- Must look good in a phone-screenshot — that's how it will actually be shared. Mobile-first, 390px viewport is the primary target.
- No player photos or federation/FIFA logos (rights). Silhouettes, initials, or emoji only.

## Testing

- `MODE = "SIMULATION"` in `config.js` runs a scripted match: kickoff → quiet Haaland hour → 2 late Haaland goals → penalties. Use it to check every gauge zone and ticker template renders.
- Test the proxy against a live fixture this afternoon before pointing it at tonight's game.

## Don'ts

- Don't add React/build tooling.
- Don't commit the token or a `.env` file (add `.env*` to .gitignore).
- Don't reproduce real commentary transcripts, chants or lyrics; write originals in the style.
- Don't use FIFA/club/federation logos or player photographs.
