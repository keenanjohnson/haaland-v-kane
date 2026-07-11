// ⚔️ Impact-o-meter config — CLIENT-SIDE FILE, NO SECRETS EVER.
// The Sportmonks token lives only in the SPORTMONKS_TOKEN env var on Vercel.

window.CONFIG = {
  // "SIMULATION" = scripted fake match (default, always works).
  // "LIVE"       = poll /api/match (requires SPORTMONKS_TOKEN on the server
  //                and FIXTURE_ID below).
  MODE: "SIMULATION",

  // Sportmonks fixture ID for Norway vs England, 2026-07-11.
  // Find it before kickoff:
  //   GET https://api.sportmonks.com/v3/football/fixtures/date/2026-07-11
  // then set it here AND redeploy. null = /api/match will try to discover it
  // from the inplay livescores by team names, but hardcoding is safer.
  FIXTURE_ID: 19606970, // Norway vs England, 2026-07-11 21:00 UTC (verified via fixtures-by-date)

  // How often the frontend polls /api/match in LIVE mode (ms). Keep 20–30s.
  POLL_MS: 25000,

  // Simulation pacing: real milliseconds per simulated match-minute.
  // 1200ms ≈ full match incl. penalties in ~3 minutes. Set higher for a
  // slower demo.
  SIM_MS_PER_MINUTE: 1200,
};
