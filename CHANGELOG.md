# Workout App Changelog

## v13.0 — 2026-07-17
### Schema hardening (Supabase `workouts` + `exercise_pr_flags`)
- Backed up `workouts` to `workouts_backup_v13` before any destructive change.
- Deduplicated the two known `(date, sprint)` row pairs, plus two more collisions
  surfaced by the `workout_type` normalization itself (`2026-07-08`/`legs` and
  `2026-04-29`/`sprint`) — merged with an audit trail in `session_notes`.
- Backfilled and constrained `workouts.id` as a real identity primary key
  (was NULL on 75/81 rows).
- Normalized `workout_type` to 8 canonical values (`upper/push/pull/legs/arms/flex/sprint/recovery`)
  with a CHECK constraint; `cardio` → `sprint`, `fort` → `legs` (original value preserved in notes).
- Normalized the 4 raw variants of `location` (`home gym`/`Home Gym`/`home_gym`/`Lifetime Fitness`)
  down to the 2 canonical values; backfilled 3 rows still NULL where unambiguous.
- `workout_date` TEXT → DATE; added `UNIQUE (workout_date, workout_type)`; added
  `CHECK (duration_minutes BETWEEN 1 AND 240)` after nulling 5 bogus values (BUG-18).
- Normalized the exercise JSONB to one canonical schema (`name/type/muscleGroup/done/sets/
  failureWeight/burnoutWeight/burnoutReps/notes`), stripping `[HG]`/`[LT]` tags from names.
- Added a trigger that auto-maintains `exercise_pr_flags` (current PR, weeks-at-PR, `pr_ready`)
  on every workout insert/update, scoped per `(exercise_name, workout_type, location)` so PRs
  never compare across gyms.
- Removed the unrestricted anon `DELETE` policy on `workouts`. Full `auth.uid()`-scoped RLS
  (requires wiring Supabase Auth into the client) is intentionally deferred — see summary.

### App fixes
- BUG-2: exercise names no longer get `[HG]`/`[LT]` appended on save; `location` column is
  the only source of truth.
- App bug: workout saves now emit the canonical exercise schema (type/failureWeight/
  burnoutWeight/burnoutReps/notes) instead of the stripped-down `{name,muscle,done,sets}` shape.
- App bug: duplicate `(date, type)` saves now prompt "update instead?" and PATCH by
  `workout_date`+`workout_type` rather than silently no-op'ing (was `resolution=ignore-duplicates`).
- BUG-18: a session timer reading over 240 minutes is sent as NULL, not the raw value.
- Hassan Protocol: prompt for the burnout weight explicitly at the failure step instead of
  carrying forward a stale default.
- Added "Walking Lunges (DB)" to the Leg Day exercise library (previously missing, which is
  why it kept getting mislabeled as Seated Leg Curl in exports).
- BUG-LEGCURL-SWAP: corrected the July 14 session where Lying/Seated Leg Curl were logged
  under each other's names; scanned the rest of history and found no other occurrence with
  the same clear structural signature.
- FEAT-15: removed FORT NYC (the Tuesday cancel/home-sub toggle, `fortCancelled` state, and
  `WORKOUTS.fort`). Tuesday is now a fixed Lower Day using the same leg program as Sunday.
  Note: this branch does **not** include the "swap to a class on any day" widget — see summary.

### Tests
- Added `tests/regression.test.js` (Node's built-in test runner) covering the 6 required
  cases from the hardening doc, wired into CI via `.github/workflows/tests.yml` on every
  push to main and on pull requests.

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
