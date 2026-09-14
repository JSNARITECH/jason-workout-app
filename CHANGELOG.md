# Workout App Changelog

## v12.3 — 2026-09-14
### Added
- **Make-up sprint on any day** — "Swap today's session" on Mon/Tue/Thu/Fri/Sun now offers ⚡ Make-Up Sprint above the classes. It launches the real sprint interval timer (same warm-up / 6×30s / 75s rest / cool-down engine and save path as Wed/Sat), shows a banner with a one-tap way back, and the saved session counts toward the sprint streak and the Sunday check-in.
### Fixed
- Saving a sprint or workout now refreshes the accountability dashboard immediately (sprint count, reset-week logged days) instead of on the next render.

## v12.2 — 2026-09-14
### Added
- **FEAT-11 Accountability dashboard** — top of the TODAY tab on every day type: sprint streak (consecutive weeks with 2+ sprints), alcohol-free days, protein 225g+ and bed-by-10PM daily toggles. Toggles persist to localStorage and the new `daily_habits` table.
- **FEAT-12 Sunday check-in** — mandatory modal on Sundays (sprints, alcohol, sleep, protein, fasted walks, notes) saved to `weekly_checkins` with a 0–5 score, a 4-week trend and a recovery-priority prompt under 3. Status line on the dashboard.
- **FEAT-13 Visceral fat grade widget** — latest `body_composition` grade with colour status (≤10 green, 11–12 yellow, 13 orange, 14+ red), direction vs the previous scan, scan age and a >14-day rescan nudge.
- **FEAT-14 Reset Protocol week** — offered after a 7+ day gap (or manually / from a low check-in score): push/pull fold into upper/lower, PRs become reference-only, daily sprint/walk/protein/sleep checklist, auto-exits after 7 consecutive logged days.
- **FEAT-15 Group class swap on any day** — "Swap today for a group class / activity" on every workout day (yoga, pilates, dance, boxing, new Group HIIT Class), with a one-tap way back. Activity sessions now save as `flex` (the `workouts` type constraint rejected the old `rest` value).
- **FEAT-9 Pick & choose** — add exercises from the tiered library, remove or reorder today's list, restore the preset. The day type is kept for logging; timer, progress, summary and save follow the session list.
- **FEAT-10** — burnout weight row added to Cable Low-to-High Fly and Lat Pulldown (Pull) so all Hassan exercises capture failure and burnout weights separately.
### Changed
- **FORT NYC removed** — Tuesday is a fixed Lower Day (Leg Day programming); the FORT toggle, banner and type-selector entry are gone. History filters gain Sprint and Class / Flex.

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
