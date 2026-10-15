# Workout App Changelog

## v12.8.2 — 2026-10-15
### Changed
- **Sprints default to 8 rounds** (was 6) on Wed, Sat and make-up sprints: same 30s max effort / 75s walk recovery. One `SPRINT_DEFAULT_ROUNDS` constant; the ± stepper still allows 4–10. Tips updated (~27 min/session, push the last rounds to 170+ bpm). Replaces the unmerged PR #18, which was built on v12.4 and went stale.

## v12.8.1 — 2026-10-12
### Fixed
- Phones kept showing a stale copy of the app (the old Hassan-on-every-exercise program) after v12.8 deployed. `vercel.json` now sends `Cache-Control: no-cache` for the HTML, and the app checks the served version on load and reloads once if it's newer.

## v12.8 — 2026-10-12
### Changed — lean program, Hassan ladders retired
- **Every lift is now warm-up (first lifts only) + 2 working sets, the last to failure.** Double progression: hit the top of the rep range on both sets → add a plate. Each card shows the target ("10 + 10 → add a plate").
- **One Hassan finisher per day** — work set to failure + 20-rep rest-pause burnout: Upper → rope pushdown, Push → overhead rope extension, Pull → supinated cable curl, Legs → calf raise.
- **Shorter sessions:** Upper 9 → 8 slots (biceps/triceps supersetted), Push 7 → 6, Pull 5, Legs 8 → 6. Heaviest lifts come first while fresh (chest press now before pec deck).
- **Knee-safe legs:** Smith squat to a box/pain-free depth (auto-swaps to Belt Squat at Lifetime), Smith RDL added, Bulgarian split squat, leg extension and lying leg curl removed; cable crunches are standing (no kneeling); couch-stretch cue offers a standing version.
- **Abs:** heavier standing cable crunch Mon/Sun, hanging knee raise on Push day (replaces bicycle crunch), plus the daily kettlebell circuit.
- Removed: Cable Low-to-High Fly (Upper/Push), Straight-Arm Pulldown (Pull). Added: Reverse Pec Deck (Pull).
- Per-exercise rest for working sets (`restWork`): ~2.5 min main lifts, 60–75s isolation.
- Location substitutions now apply in `getSessionSections`, so render, timer and save all see the same exercise.

## v12.7 — 2026-10-12
### Added
- **FEAT-22 Guided kettlebell timer** — "▶ Guided timer — no counting" on the kettlebell card opens a full-screen interval timer. Each move is split into timed sets (reps × pace) with rests, a 10s "up next" between moves, voice callouts ("Kettlebell swings. Set 2 of 5. 10 reps. Go."), a go-tone, 3-2-1 ticks and a ding at the end of each set. Every finished set logs its reps to the card automatically. Easy / Normal / Fast pace, voice on/off, pause/skip/end, screen kept awake. Timing runs off timestamps so a locked phone catches up instead of drifting. ≈16 min for the full circuit at Normal pace.
- **FEAT-21 Kettlebell history** — 28-day dot strip (done / partial) with this-week and 30-day counts on the kettlebell card.
### Changed
- **Suitcase carry → Single-Arm Knee Raise** (50: 25 holding the bell in each hand). A day already logged with the old carry still counts as complete.
- Default heavy bell is now 25 lb (heaviest at the home gym).
- **"Time to switch up" moved onto the exercise** — the stacked banners at the top of the workout are gone. The flag on the card reads "🔄 Switch up" and opens the swap sheet; inside the card there's a "Pick a swap" / "Keep it" row ("Keep it" clears the prompt).

## v12.6 — 2026-10-12
### Added
- **FEAT-20 Daily Kettlebell circuit** — a 🔔 card under the accountability dashboard on every day type: Halos 50, Around the World 50, Horizontal Press 50, Swings 50, Suitcase Carry 5 × 30m. Tap +10 per set, ✓ to fill a move, − to undo. Heavy/light bell weights are remembered between days.
  - Rotational swings were swapped for suitcase carries (twisting under a ballistic load is the classic lower-back flare pattern).
  - Day-aware: swings drop to 25 on Tue/Sun leg days (RDLs already load the hinge); presses carry a "go light" note on Mon/Thu.
  - Collapses to a ✓ DONE line with a day streak once complete. Saved to `daily_habits.kettlebell` (bool) + `daily_habits.kettlebell_log` (jsonb: reps per move, bell weights) — local copy first, server upsert after.
- Version note: v12.5 is reserved for the FEAT-19 watch-screenshot branch that isn't merged yet.

## v12.4 — 2026-09-16
### Added
- **🍖 FUEL button** in the bottom nav — opens the new keto macro tracker at `/macros.html`. The tracker carries a 🏋️ LIFT button back, so the two apps read as one system without merging their code.
- **Macro tracker (macros.html v1.0)** — protein-first keto logging against 225g/day, calorie targets pulled live from the latest `body_composition` scan (not hardcoded), 30g net-carb ceiling, and an 18:6 / 16:8 fasting-window indicator that nudges when the window is closing with protein still short.
  - Tap-to-log food tiles for the ~34 foods actually on the menu, quantity stepper sized per unit, long-press to favorite, carb-flag warnings on shellfish.
  - **Meal composer** — the five template days are starting points whose individual meals swap freely, with a running protein total against 225g.
  - **Portion editing** — any logged entry reopens with "Ate half" / "Didn't eat it", because plated and eaten are different numbers.
  - **Paste from Claude** — pastes photo-estimate lines (`Ribeye, 14 oz | 98g protein | 1260 cal | 0g net carbs`) into entries.
  - 30-day trend: protein hit rate, average calories, days over the carb ceiling, bar chart against the target line.
- New `foods` and `nutrition_log` tables plus five `nutrition-*` edge functions. Both tables have RLS on with no anon policies — the tracker holds no anon key and reaches Supabase only through the service role.

## v12.3 — 2026-09-14
### Added
- **Make-up sprint on any day** — "Swap today's session" on Mon/Tue/Thu/Fri/Sun now offers ⚡ Make-Up Sprint above the classes. It launches the real sprint interval timer (same warm-up / 6×30s / 75s rest / cool-down engine and save path as Wed/Sat), shows a banner with a one-tap way back, and the saved session counts toward the sprint streak and the Sunday check-in.
- **Make-up sprint eligibility badge** — the option reads yesterday/today/tomorrow's leg load (schedule + overrides + swaps) and this week's sprint count: DONE (already logged today) and BLOCKED (sprinted yesterday) are not tappable; CAUTION for heavy legs yesterday (4–6 rounds), AM ONLY for heavy legs tomorrow, AT CEILING at 3+/week, a warning when it would replace Leg Day; OK on pull day, IDEAL otherwise. The reason and timing note repeat on the sprint screen.
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
