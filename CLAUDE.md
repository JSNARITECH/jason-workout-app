# Jason's Workout App — Comprehensive System Documentation

**Purpose:** Personal strength training tracker with adaptive workout protocols, PR management, recovery modes, and multi-location gym support.

**Current Version:** v11.1 (2026-03-18)  
**Development Branch:** `claude/tender-newton-pHu5K`  
**Deployment:** Vercel (single HTML file + Supabase backend)

---

## 1. ARCHITECTURE OVERVIEW

### Stack
- **Frontend:** Single HTML file (index.html, ~5500 lines) with inline CSS + vanilla JavaScript
- **Backend:** Supabase (PostgreSQL + REST API + Edge Functions)
- **Persistence:** Dual-layer — localStorage (client-side) + Supabase (cloud)
- **Deployment:** Vercel (static hosting) + GitHub Actions (CI/CD version tracking)
- **Device Support:** Mobile-first (480px max-width), works on phones and Galaxy Watch

### Key Design Decisions
1. **Single HTML file** — No build step, no framework dependencies, rapid iteration
2. **localStorage as primary** — Works offline, instant sync to Supabase when online
3. **PR Store initialized empty** — Supabase is source of truth, prevents stale local PRs
4. **Dual-layer rest timer** — Smart REST_DEFAULTS calculated from exercise type + manual overrides
5. **Location-scoped data** — Notes, PRs, workouts filtered by Home Gym (HG) / Lifetime Fitness (LT)

---

## 2. DATA MODELS

### Supabase Schema

#### `workouts` Table
```
workout_date   (text)       — YYYY-MM-DD
workout_type   (text)       — 'upper'|'push'|'pull'|'legs'|'flex'
location       (text)       — 'Home Gym' | 'Lifetime Fitness'
exercises      (jsonb)      — Array of {id, name, sets: [{weight, reps}], notes}
user_email     (text)       — User identifier (stored by Supabase auth)
```

#### `exercise_notes` Table
```
exercise_id    (text)       — Exercise ID (e.g., 'u-bench')
exercise_name  (text)       — Display name
note_date      (text)       — YYYY-MM-DD
location       (text)       — 'Home Gym' | 'Lifetime Fitness' (NEW — BUG #1 fix)
note           (text)       — User's session note
workout_type   (text)       — For context
updated_at     (timestamp)  — Last modified time
Unique constraint: (exercise_id, note_date, location)
```

#### `exercise_pr_flags` Table
```
exercise_id    (text)       — Exercise ID
flagged_date   (text)       — When PR was achieved
source         (text)       — 'app' | 'supabase' | 'manual'
user_email     (text)       — User identifier
```

#### `app_versions` Table
```
version        (text)       — Semantic version (v11.1, v12.0)
commit_sha     (text)       — Git commit hash
deployed_at    (timestamp)  — Deployment timestamp
app_state      (text)       — Release notes / changelog
```

---

## 3. CORE DATA STRUCTURES (JavaScript)

### Global State Objects

```javascript
const WEEK = [
  { label: 'Mon', type: 'upper' },
  { label: 'Tue', type: 'push' },
  { label: 'Wed', type: 'flex' },  // Swappable (recovery or sprint)
  { label: 'Thu', type: 'pull' },
  { label: 'Fri', type: 'legs' },
  { label: 'Sat', type: 'flex' },  // Recovery day
  { label: 'Sun', type: 'legs' }
];

const WORKOUTS = {
  upper: { label: 'Upper Day', sections: [...] },
  push:  { label: 'Push Day', sections: [...] },
  pull:  { label: 'Pull Day', sections: [...] },
  legs:  { label: 'Leg Day', sections: [...] },
  flex:  { label: 'Flex Day', sections: [...] },
  rest:  { label: 'Rest Day', sections: [] }
};
```

### Exercise Object Structure
```javascript
{
  id: 'u-bench',                              // Unique identifier
  name: 'Barbell Bench Press',                // Display name
  muscle: 'chest',                            // Muscle group
  tier: 'A',                                  // S+ / S / A / B (exercise ranking)
  equip: 'free' | 'machine' | 'cable' | ... // Equipment type
  
  sets: [                                     // Array of set definitions
    { wt: 121, reps: '8' },
    { wt: 143, reps: 'FAIL' },
    { wt: 121, reps: '20', note: 'Burnout' }
  ],
  
  chips: {                                    // UI display metadata
    sets: '3 Sets',                           // Total sets count (BUG #2 fix)
    reps: '8-12 reps',
    pr: 'PR: 137×12',
    target: 'Target: 143 lbs',
    tag: 'Hassan'
  },
  
  // Optional fields
  hassan: true,                               // Hassan Protocol flag
  ladder: ['121×6', '132×4', '143×FAIL'],   // Progression ladder
  burnout: '121 lbs × 20 reps',              // Burnout description
  warnSpinal: true,                          // Back recovery warning
  optional: false,                           // Can skip (FEAT-6)
  cue: 'Cue text for form...',              // Training cue
}
```

### Session State
```javascript
sessionState = {
  'u-bench': {                    // Exercise ID
    done: false,                  // Completed?
    weights: [121, 143, 121],    // Actual weights used (user input)
    setsDone: { 0: true, 1: true, 2: false },  // Per-set completion
    skipped: false,               // (FEAT-6) Skipped?
    galleryURL: null,             // Watch screenshot URL
    avgHR: null,                  // Galaxy Watch avg heart rate
    maxHR: null,                  // Galaxy Watch max heart rate
  }
};

sessionStart = Date.now();        // Session timestamp for 24h stale guard
```

### Persistent Stores (localStorage + Supabase)
```javascript
prStore = {
  'u-bench': { weight: 137, date: '2026-06-04', source: 'supabase' },
  // Or for swapped exercises:
  'u-bench:Smith Machine Bench': { weight: 150, date: '2026-06-03' }
};

prStreaks = {
  'u-bench': 3,  // Consecutive PR sessions for auto-progression
};

swapOverrides = {
  'u-bench': 'Smith Machine Bench',  // Current exercise swap
  // ... (per-exercise overrides)
};

restOverrides = {
  'u-bench': 120,  // Custom rest time (seconds)
};

notesStore = {
  'u-bench': {
    todayNote: '...',      // Today's session note
    lastWeekNote: '...',   // Note from 5-10 days ago
    weekCount: 4           // Weeks with notes in a row
  }
};

exerciseFreq = {
  'u-bench': { lastUsed: '2026-06-04', count: 47 },
};

dayTypeOverride = {
  '2026-06-04': 'upper',  // Override scheduled type for this date
};

prSyncCache = {
  'upper': 1717513600000,  // Timestamp of last sync (5-min TTL)
};
```

### Constants
```javascript
const REST_DEFAULTS = {
  warmup: 30,           // Warmup set
  isolation: 60,        // Single joint exercises
  pre_exhaust: 50,      // Pre-exhaust pair
  moderate_compound: 90, // Standard multi-joint
  heavy_hassan: 150,    // Hassan Protocol heavy ladder
  burnout: 45,          // Final burnout set
};

const PR_SYNC_TTL = 5 * 60000;  // 5 minutes — prevent Supabase hammering
const SESSION_STALE_HOURS = 24;  // Sessions older than this are abandoned
```

---

## 4. MAJOR FEATURES

### 4.1 Workout Types & Weekly Rotation
- **Upper Day (Mon)** — Upper body strength focus
- **Push Day (Tue)** — Horizontal + vertical press emphasis
- **Pull Day (Thu)** — Row + pulldown emphasis
- **Leg Day (Fri/Sun)** — Lower body compound
- **Flex Day (Wed/Sat)** — Swappable based on recovery mode
- **Sprint (Wed alt)** — Hassan Protocol leg focus with Galaxy Watch data
- **Vacation Mode (all days)** — Gym-free maintenance routines

### 4.2 Back Recovery Mode
Global toggle (🦴 pill in header) that:
- Replaces Wed/Fri/Sat/Sun with spine-safe rehab protocols
- Uses McKenzie Method + extension-in-standing exercises
- Prevents high-risk movements (RDL, heavy compounds)
- Persists to localStorage and displayed in workout plan
- Shows ⚠️ Spinal Caution badges on risky exercises

### 4.3 Hassan Protocol
Progressive ladder system for main compound movements:
```
E.g., Barbell Bench Press ladder: 121×6 → 132×4 → 143×FAIL → 121×20 Burnout
- First weight: 6 reps warm-up/first set
- Intermediate: 4 reps intermediate load
- Final: 1 rep max (to failure)
- Burnout: High reps, same initial weight, pump/endurance
```
Triggers 150s rest between sets (heavy ATP recovery).

### 4.4 PR Tracking & Isolation
- **Global PRs** — Highest weight ever lifted per exercise
- **Equipment-scoped PRs** — Smith bench ≠ Barbell bench (prevents equipment downgrades)
- **Location-scoped PRs** — Home Gym vs Lifetime Fitness tracked separately
- **Key:** `prStore[exId:swappedName]` — If swapped, PR key includes the swap
- **Auto-upgrade** — Syncs from Supabase every 5 min (prevents stale local data)
- **🚀 Level Up badge** — Auto-progression trigger after 3 consecutive PR sessions
- **Gold star (🏆)** — Visual indicator on PRs in session input

### 4.5 Galaxy Watch Integration
- **BPM Screenshot Scan** — Edge function analyzes Samsung Health screenshots, extracts BPM/zones
- **Per-exercise HR tracking** — Avg/max HR for cardio/conditioning sessions
- **REST mode widget** — Minimizable pill shows current rest countdown + next exercise
- **Sprint day data** — HR zones auto-captured during Hassan ladder attempts

### 4.6 Exercise Swapping (FEAT-4)
- Per-exercise "Swap" button opens bottom sheet with tier-sorted alternatives
- Filtered by equipment (Machine / Smith / Cable / Free Weight)
- Excludes exercises already in today's workout
- Updates display name in timer + PR isolation key
- Rest time derived from swapped exercise config (not original)

### 4.7 Location Tagging (FEAT-2)
- Session-level selector: [HG] Home Gym or [LT] Lifetime Fitness
- Appended to exercise names in saved workouts
- Filters PRs, notes, and workout history by location
- Prevents location cross-contamination in data
- Default: Home Gym (localStorage persisted per device)

### 4.8 Smart Rest Timer
**Calculation hierarchy:**
1. Manual override (restOverrides[exId])
2. Hassan-aware smart default:
   - Warmup → 30s
   - Isolation (≤2 sets) → 50-60s
   - Pre-exhaust pair → 50s
   - Compound (Hassan, heavy) → 90-150s
   - Burnout → 45s
3. Falls back to moderate_compound (90s)

**UI:** Minimizable pill with countdown, next exercise name, set info.

### 4.9 Exercise Notes & Pattern Detection
- Per-exercise textarea, auto-saves on blur to Supabase
- **Last week callout** — Surfaces note from 5-10 days ago
- **Pattern alert** — "You've noted this 3 weeks in a row" (workflow friction detector)
- **Location-scoped** — Home Gym notes separate from Lifetime Fitness (BUG #1 fix)
- Unique constraint ensures no duplicate notes per date/gym

### 4.10 Rotation & Workout Flexing
- **FORT Tuesday (FEAT-3)** — Swaps Tue to home lower body if gym unavailable
- **Daily type override** — Map dates to custom workout types (dayTypeOverride)
- **Flex day assignments** — Wed/Sat can be recovery or sprint based on rotation
- **Vacation Mode** — Switches all days to gym-free routines with bodyweight/minimal equipment

---

## 5. BUG TRACKING & RECENT FIXES

### Fixed Bugs (Commit: a80be1c)

#### BUG #1: Exercise Notes Scope
**Issue:** Notes from different gym locations mixed together.
**Fix:** 
- Added `location` column to exercise_notes table
- Fetch query filters: `&location=eq.${locationValue}`
- Save includes: `location: sessionLocation === 'HG' ? 'Home Gym' : 'Lifetime Fitness'`
- Unique constraint: (exercise_id, note_date, location)

#### BUG #2: Hassan Extra Row
**Issue:** Hassan exercises with burnouts showed "2 Sets" but displayed 3 set rows.
**Fix:**
- Updated 10 Hassan exercises' chips from "2 Sets" → "3 Sets"
- Affects exercises with burnout set defined in `sets` array
- Example: Barbell Bench has `sets: [121×8, 143×FAIL, 121×20 Burnout]` (3 sets)

#### BUG #3: Lateral Raise Weight Mismatch
**Issue:** Upper Day lateral raise (15 lbs) was far below Push Day (40-50 lbs).
**Fix:**
- Upper Day Cable Lateral Raise: 15 lbs → 40-50 lbs
- Updated chips: "PR: 15×15" → "PR: 50×20"
- Aligns progression across upper body workout days

#### BUG #4: PR Sync Stale on Load (ALREADY FIXED)
**Status:** Fixed in previous release
- prStore initialized empty (line 1754) instead of loading from localStorage
- Comment: "Supabase is the source of truth"
- Prevents stale local PRs overriding remote data

---

## 6. DEVELOPMENT WORKFLOW

### Branch Strategy
- **Main branch** (`main`) — Production
- **Feature branches** (`claude/tender-newton-pHu5K`, etc.) — Development
- **Naming convention** — `claude/[adjective]-[noun]-[random-id]`
- No automatic PRs — Only created when explicitly requested

### Git Operations
```bash
# Always fetch before work
git fetch origin

# Push changes to development branch
git push -u origin claude/tender-newton-pHu5K

# Commit message format:
# [TYPE]: Brief description
# 
# - Detailed bullet points
# - Explain the WHY, not the WHAT
# 
# Refs: Jira/GitHub issue if applicable
```

### Version Management
- **Version constant** in HTML: `const APP_VERSION = 'v11.1'`
- **Automatic logging** via GitHub Action on every main push
- Logs to `app_versions` table with commit SHA
- Rendered in bottom-right corner of UI

### Testing & Verification
1. **Local testing** — Load index.html in browser (localhost or Vercel)
2. **Feature testing** — Use `/verify` skill to manually test workflows
3. **Multi-device** — Test on phone + Galaxy Watch (if applicable)
4. **Regression check** — Verify existing features still work (timer, swaps, notes, PRs)

---

## 7. SUPABASE EDGE FUNCTIONS

### `analyze-bpm` Function
**Purpose:** Extract BPM and HR zones from Samsung Health screenshots via Claude Vision.

**Trigger:** User selects screenshot from Photos
**Input:** Base64-encoded image
**Output:** 
```json
{
  "bpm": 165,
  "zones": {
    "zone1": 45,  // Z1: Recovery
    "zone2": 120, // Z2: Base
    "zone3": 180, // Z3: Tempo
    "zone4": 240, // Z4: Threshold
    "zone5": 300  // Z5: VO2 Max
  }
}
```

**Implementation:** Calls Anthropic Claude API with vision capability, parses response.

---

## 8. COMMON PATTERNS & CODE CONVENTIONS

### Fetching from Supabase
```javascript
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/TABLE_NAME?filter=condition&select=columns`,
  {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`
    }
  }
);
```

### Saving to Supabase
```javascript
await fetch(
  `${SUPABASE_URL}/rest/v1/TABLE_NAME?on_conflict=constraint_name`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: 'resolution=merge-duplicates'  // Upsert behavior
    },
    body: JSON.stringify({ ...row })
  }
);
```

### Render Functions Pattern
```javascript
function renderExerciseCard(ex, type) {
  let detail = '';
  
  // Build detail HTML (sets table, rest config, notes)
  detail += `<table>...</table>`;
  detail += `<div>...</div>`;
  
  return `<div class="ex-card">
    <div class="ex-hdr">...</div>
    <div class="ex-detail">${detail}</div>
  </div>`;
}
```

### Async Initialization Pattern
```javascript
async function init() {
  // 1. Load all persistent data
  await loadAll();
  
  // 2. Sync fresh data from Supabase
  await syncPRsFromSupabase(workoutType);
  
  // 3. Render UI
  buildUI();
}
```

---

## 9. ENVIRONMENT & CONFIG

### Supabase Credentials
- **SUPABASE_URL** — `https://[project-ref].supabase.co`
- **SUPABASE_ANON** — Public anon key (embedded in HTML)
- Stored in window object during app load

### localStorage Keys
```
session-YYYY-MM-DD              // Current session state
workout-crash-YYYY-MM-DD        // Crash recovery backup
session-location                // HG or LT
back-recovery-enabled           // Boolean
day-type-override-YYYY-MM-DD    // Type override
fort-cancelled-YYYY-MM-DD       // FORT Tuesday flag
pr-store                        // JSON stringified PRs
pr-streaks                      // JSON stringified streaks
exercise-freq                   // Exercise usage tracking
rest-overrides                  // Custom rest times
swap-overrides                  // Current exercise swaps
pr-flags                        // PR flag state
exercise-history                // Completed sessions
[exercise-id]-notes             // DEPRECATED (use Supabase now)
```

---

## 10. MIGRATION & SCHEMA NOTES

### Recent Schema Changes
1. **exercise_notes.location** — Added for gym scoping (BUG #1)
   ```sql
   ALTER TABLE exercise_notes ADD COLUMN location TEXT;
   CREATE UNIQUE INDEX ON exercise_notes(exercise_id, note_date, location);
   ```

2. **exercise_pr_flags.source** — Track origin of PR
   ```sql
   ALTER TABLE exercise_pr_flags ADD COLUMN source TEXT DEFAULT 'app';
   ```

### Backward Compatibility
- Old notes (null location) treated as "Home Gym" by default
- New syncs overwrite old location-less rows
- No data loss, gradual migration

---

## 11. PERFORMANCE & OPTIMIZATION

### Caching Strategy
- **prSyncCache** — 5-minute TTL per workout type (prevents API hammering)
- **sessionTimerInterval** — Cleared on new session (prevents memory leak)
- **Debounced weight input** — onchange + oninput for live PR feedback

### Storage Limits
- localStorage ~5-10MB (safe for ~500 historical workouts)
- Supabase free tier: 500K API calls/month (easily covered)
- Edge function invocations: ~100/month typical

### Network Resilience
- All Supabase calls wrapped in try-catch
- Falls back to localStorage if sync fails (silent error handling)
- Session data always saved to localStorage first (fast crash recovery)

---

## 12. HERMES AGENT INTEGRATION POINTS

### What Hermes Should Know
1. **Single HTML file** — All logic in one file, search carefully before editing
2. **Location scoping** — Filter queries by sessionLocation (HG/LT)
3. **Exercise metadata** — `WORKOUTS[type].sections[].exercises` contains all definitions
4. **PR system** — Uses `getPRKey(exId)` to generate unique keys (includes swap info)
5. **Async patterns** — All Supabase calls are async/await, don't block UI
6. **localStorage fallback** — Never assume Supabase is available, always fallback

### Common Tasks
- **Add exercise** — Edit WORKOUTS object, define sets/ladder/chips/cue
- **Fix bug** — Locate in index.html, test locally, commit with clear message
- **Add feature** — Follow render + logic pattern, persist to localStorage + Supabase
- **Debug** — Check browser console (F12), check localStorage contents, verify Supabase queries

### API Surface
```javascript
// Fetch data
await loadAll()                               // Load all persistent data
await syncPRsFromSupabase(type)              // Sync PRs for workout type

// Render
renderWorkoutView()                          // Main UI render
renderExerciseCard(ex, type)                 // Single exercise
buildUI()                                    // Layout + nav

// Persistence
saveSession()                                // To localStorage + window.storage
updatePRStore(exId, weights)                 // Update PRs
saveExerciseNote(exId, exName, type)        // Save note to Supabase
saveWorkout(type)                            // Save completed session

// State management
toggleDone(event, exId, type)               // Mark exercise done
completeSet(exId, setIdx, type)             // Per-set tracking
updateWeight(exId, setIdx, val)             // Update weight input
```

---

## 13. DEBUGGING CHECKLIST

When investigating issues:

- [ ] Check `console.log` / browser DevTools console for errors
- [ ] Verify `sessionLocation` is set correctly (HG vs LT)
- [ ] Check `localStorage` contents (DevTools → Application → Storage)
- [ ] Verify Supabase credentials in Network tab (API calls to .supabase.co)
- [ ] Check if data is truly in Supabase (query via SQL editor)
- [ ] Verify prStore is initialized empty on app load (line 1754)
- [ ] Test with fresh localStorage (DevTools → Storage → Clear All)
- [ ] Check that async functions are properly awaited in call chain

---

## 14. RESOURCES & REFERENCES

- **GitHub:** https://github.com/JSNARITECH/jason-workout-app
- **Supabase Project:** (Embedded credentials in HTML)
- **Deployment:** https://jason-workout-app.vercel.app/ (or current Vercel URL)
- **Changelog:** See CHANGELOG.md for version history
- **Back Recovery Docs:** See docs/lateral-shift-sources-extracted.md for medical sources

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-04  
**Next Review:** After next major feature or schema change

