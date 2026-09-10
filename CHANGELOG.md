# Workout App Changelog

## v12.3 — 2026-09-09
### Added
- **Day-type override (per date)** — swap what session a specific date runs without changing the base `WEEK` schedule. Session chips (Upper / Push / Pull / Legs / Lower / Rest·Sprint) at the top of both the workout and rest-day views; `↩ Reset to [original]` link with a date-only note; `•` marker on the day pill. Persisted under `day-type-overrides` keyed by ISO date, so next week falls back automatically. `effDay(idx)` replaces raw `WEEK[idx]` reads in the render path; 
- **Sprint eligibility engine** — `sprintEligibility(idx)` rates each day (DONE / BLOCKED / CAUTION / OK / IDEAL) from leg load (`legs`/`lower` heavy, `pull` light, `upper`/`push`/`rest` none), yesterday's sprint, weekly count, and tomorrow's session, with a reason, recommended rounds, and a timing note (rest days: AM fasted; lifting days: after the lift).
- **Catch-up banner** — when fewer than 2 sprints are logged this week, ranks the remaining days and renders them as tappable chips. Fail-safe: if the target can't be hit without stacking consecutive days, it says to eat the miss.
- **Sprint interval timer** — full-screen overlay (separate from the rest timer) with three protocols (Standard 20/40 ×10, Treadmill 30/90 ×6, Short 20/40 ×6), rounds stepper, 5-min warm-up → work/rest → 3-min cool-down, phase-coloured progress ring (work red, rest green, warm-up/cool-down blue), round pips, coaching cues, audio (high tone → work, low tone → rest, 3-2-1 beeps), pause / skip / two-tap end, and `navigator.wakeLock`. Finishing or ending early logs `{date, protocol, rounds, workSeconds, completed}` to `sprint-log` (partial sessions count) and toasts the weekly count.

### Removed
- **FORT Tuesday** — no longer training there. Tuesday is now a first-class `lower` session (`WORKOUTS.lower`: the former home-gym sub + ab finisher + hip mobility, same exercise IDs so PRs carry). The FORT-cancelled banner, toggle, and `fort-cancelled-*` storage flag are gone. Old `fort` records still render in History.

### Changed
- Header session label now reads today's *effective* session.
- Sprint card: protocol picker + stepper + START replace the inline clock; Supabase save and Claude share report the rounds actually logged and the protocol used.

## v12.2 — 2026-09-08
### Added
- **Next-session target badges** — on workout load the app calls the `next-targets` edge function (`?type={dayType}&location={gym}`) and renders a 🎯 badge with `effective_target_lbs` next to each matching exercise name.
  - Dimmed badge when `has_explicit_target` is false (the number is a PR floor, not a set target).
  - ⏳ suffix when `stale` is true (target older than 21 days).
  - Response cached per day + location for the session, so each combination is fetched once. Switching gyms re-fetches for the new location.
  - Fails silently — if the fetch errors, badges simply don't render.

## v11.1 — 2026-03-18
### Added
- **Back Recovery Mode** — global toggle (🦴 pill in header) swaps all workout days to spine-safe rehab protocols when active. Persists via localStorage.
- Additional back recovery exercises sourced from NotebookLM lateral shift + back recovery notebooks (all sources extracted and reviewed):
  - **Wed → Rehab Day 1:** Side Glide (McKenzie), Manual Self-Correction, Extension in Standing (EIS), Prone Lying, Cobra Press-up (EIL), Slouch-Overcorrect, Waiter's Bow
  - **Thu → Rehab Day 2:** Morning correction protocol, Cat-Cow, Seated Hamstring Stretch, Standing Backbend, Standing Knee Lift, High Knee Marches, Standing Bird Dog
  - **Fri → Subacute Recovery:** Side Glide + EIS (correction first), Dead Bug, Single Leg Bear, Bridge Level 1, Side Plank Clamshell (injured side down)
  - **Sat → Subacute Recovery 2:** Morning correction, Dead Bug progression, 4-Point Kneeling Level 2, Partial Side Plank with Leg Kick, Low-Impact Walk
  - **Sun → Seated Recovery:** Floor core (Table Top, Dead Bug, Bridge L1→L2, Clamshells) + spine-safe seated machines (Leg Extension, Hip Abduction, Seated Leg Curl)
- Source attribution added to every new recovery exercise (McKenzie Manual PDF, OrthoNC Lumbar Extension PDF, McKenzie JCDR Review, MS Trust Core Stability PDF, YouTube lateral shift sources)
- ✅/⚠️ flags on exercises per source caution levels
- `docs/lateral-shift-sources-extracted.md` — full extraction from both notebooks committed to repo as permanent source intel

## v10 — 2026-03-14
- **Build 1:** `app_versions` table in Supabase — living source of truth for app state. Claude Chat can query current version anytime.
- **Build 2:** GitHub Action auto-logs version + commit SHA to Supabase on every push to main.
- **Build 3:** `APP_VERSION` constant in app JS; version badge rendered in bottom-right corner of UI.
- **Build 4:** "📤 Send to Claude Chat" button — generates formatted workout summary (exercises, weights, BPM, notes) and opens iOS/Android share sheet or copies to clipboard.
- **Build 5:** Post-save confirmation toast confirms workout is saved and ready for Claude Chat analysis.
- **Exercise Notes:** Per-exercise textarea auto-saves to Supabase `exercise_notes` table. "Last week you said…" callout surfaces prior session notes before you start each exercise. Pattern alert after 3+ consecutive weeks of notes on the same exercise.
- **BPM Screenshot Scan:** `analyze-bpm` Supabase edge function — pick Samsung Health screenshot from Photos directly in app, Claude extracts BPM/zones automatically. No more switching to Claude Chat.
- **Exercise Swap:** Swap button on every exercise card opens bottom sheet with S/A-tier alternatives grouped by equipment (Machine / Smith / Cable / Free Weight). Filters out exercises already in today's workout.
- **PR Isolation by Equipment:** PRs tracked per exercise-equipment combination — switching Machine→Smith→DB doesn't pollute your PR records.
- **Auto-Progression:** PR streak tracking (`prStreaks`). 🚀 Level Up badge after 3+ consecutive PR sessions on same exercise.

## v9 — Previous
- Smart rest timer with per-exercise presets and minimizable pill UI
- FORT Tuesday toggle (swaps to home lower body if gym unavailable)
- Galaxy Watch BPM widget with zone bars + insight card
- JSON paste import for Samsung Health screenshot data
- Hassan Protocol ladder display + burnout badge
- localStorage as primary persistence layer (Vercel-compatible)
- `prStore` for PR tracking with gold star on weight inputs
- Session timer with 24h stale-guard
- Lat Pulldown sets fix (2 sets, burnout via badge not row)
