# ⚔️ THE IMPACT-O-METER: Haaland vs Kane

A single-page, boxing-poster-style **live impact meter** comparing Erling Haaland and Harry Kane during the **Norway vs England World Cup quarter-final** — Saturday 11 July 2026, Miami Stadium, kickoff **10pm BST / 5pm EDT / 11pm CEST**.

Built to be shared in group chats before/during the match. The joke: Haaland famously does almost nothing for 85 minutes and then wins the game. The meter takes this extremely seriously.

## The concept

- **Tale-of-the-tape layout**: Haaland on the left (Norway red/navy), Kane on the right (England white/red), big animated IMPACT gauges for each.
- **Deliberately absurd weighting**: goals move the needle enormously; touches, passes and "general involvement" barely register. One Haaland goal should slam his gauge into a zone labelled **VIKING**.
- **Live ticker** at the bottom with dry commentary generated from real events, e.g. *"Min 63: Haaland records his 9th touch. Norway remain calm."*
- **Bonus stats row** that mixes real data (shots, touches, duels) with fake ones ("times described as 'a machine' by opponent: 1").

## Architecture

```
/               static frontend (single index.html, no build step)
/api/match.js   serverless function (Vercel) — proxies Sportmonks, hides token, caches ~15s
```

- **Frontend**: plain HTML/CSS/JS. Polls `/api/match` every 20–30s. Two modes:
  - `SIMULATION` (default until a key is configured) — scripted fake match so the page always works and can be demoed before kickoff.
  - `LIVE` — real data via the proxy.
- **Data source**: [Sportmonks Football API v3](https://docs.sportmonks.com) — World Cup 2026 package. Paid plans include a one-time 14-day free trial. Live scores/events update within seconds; player-level stats (touches, passes, shots, duels) exist as stat types — **verify they populate in-play for this tournament before relying on them** (see CLAUDE.md → Data fallbacks).
- **Hosting**: Vercel (or Netlify). One env var: `SPORTMONKS_TOKEN`.

## Setup

1. Sign up at sportmonks.com → World Cup 2026 plan (trial available). Grab your API token.
2. `vercel link` this repo (or import it in the Vercel dashboard).
3. `vercel env add SPORTMONKS_TOKEN`
4. Set `MODE = "LIVE"` and the fixture ID for Norway vs England in `config.js` (find it via the fixtures endpoint, see CLAUDE.md).
5. Deploy. Share link. Row.

## Deadline

Kickoff is **tonight at 10pm BST**. Ship something funny that works over something perfect. Simulation mode is the safety net — the page must never look broken to someone opening the link, even if the API dies mid-match.

## Not affiliated

Fan-made joke site. Not affiliated with FIFA, the FA, NFF, or either large striker.
