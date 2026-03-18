# Workout App Changelog

## v11 — 2026-03-18
### Added
- **Back Recovery Mode:** Temporary spine-safe workout override
  - Triggered by lower back lateral shift injury (March 15, 2026)
  - Header toggle switch (`RECOVERY`) — persists to `localStorage` key `recovery-mode-active`
  - Defaults to **ON** on first load after this update
  - Amber banner `⚠️ Back Recovery Mode Active — Spine-Safe Protocol` shown when active
  - **Wednesday & Thursday:** Rehab-only days — incline treadmill walk + McKenzie press-ups, cat-cow, hip flexor stretch, glute bridge, dead bug, steam room. `🛑 No Gym Today — Rehab Only` banner.
  - **Thursday:** Adds bending test card before bed — gate for Friday lifting clearance.
  - **Friday:** First modified lifting day — seated pull exercises only (lat pulldown, seated cable row, Bayesian curl, rope face pull, straight-arm pulldown).
  - **Saturday:** Modified push session — seated machine chest press, cable fly, seated cable lateral raise, overhead rope extension (⚠️ skip if pain), bicycle crunches.
  - **Sunday:** Modified legs — seated machines only (leg extension, lying leg curl, hip abduction, seated calf raise, cable crunch ⚠️). Belt squat / hack squat / leg press / RDL marked **SUSPENDED** (greyed out, strikethrough).
  - Per-exercise indicators: ✅ Spine-Safe (green), ⚠️ Monitor (amber), SUSPENDED (greyed strikethrough).
  - Toggle OFF when healed to instantly restore all normal workout splits.

### Preserved
- All normal workout splits untouched (recovery overrides view only, no data modified)
- Hassan Protocol ladder/burnout logic intact
- PR tracking, rest timers, Supabase logging unchanged
- FORT Tuesday toggle, exercise swap, auto-progression all intact

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
