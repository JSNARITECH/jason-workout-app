-- analyze-pr-flags.sql
-- For each exercise × workout_type × location (last 8 weeks):
--   1. Compute max weight lifted per ISO week
--   2. Count consecutive weeks (from most recent) where max weight has not increased
--   3. Set pr_ready = true if 4+ consecutive flat weeks
--   4. Upsert into exercise_pr_flags
--
-- Locations are normalized: 'Home Gym' and 'Lifetime Fitness' are tracked separately.
-- Run this via Supabase SQL editor or MCP execute_sql.

WITH
recent_workouts AS (
  SELECT
    workout_date::date                                       AS workout_date,
    DATE_TRUNC('week', workout_date::date)::date            AS week_start,
    workout_type,
    CASE
      WHEN location ILIKE 'home%' OR location IS NULL THEN 'Home Gym'
      WHEN location ILIKE 'lifetime%'                THEN 'Lifetime Fitness'
      ELSE location
    END AS location,
    exercises
  FROM workouts
  WHERE workout_date::date >= CURRENT_DATE - INTERVAL '56 days'
    AND exercises IS NOT NULL
    AND jsonb_typeof(exercises) = 'array'
),

exercise_rows AS (
  SELECT
    rw.workout_date,
    rw.week_start,
    rw.workout_type,
    rw.location,
    TRIM(ex->>'name') AS exercise_name,
    ex                AS exercise_json
  FROM recent_workouts rw,
  LATERAL jsonb_array_elements(rw.exercises) AS ex
  WHERE (ex->>'name') IS NOT NULL AND TRIM(ex->>'name') <> ''
),

-- Pull max weight from sets[], ladderSets[], failureWeight, burnoutWeight
session_max AS (
  SELECT
    er.workout_date,
    er.week_start,
    er.workout_type,
    er.location,
    er.exercise_name,
    GREATEST(
      COALESCE((
        SELECT MAX((s->>'weight')::numeric)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(er.exercise_json->'sets') = 'array'
               THEN er.exercise_json->'sets' ELSE '[]'::jsonb END
        ) s
        WHERE (s->>'weight') ~ '^[0-9]+(\.[0-9]+)?$'
          AND (s->>'weight')::numeric > 0
      ), 0),
      COALESCE((
        SELECT MAX((s->>'weight')::numeric)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(er.exercise_json->'ladderSets') = 'array'
               THEN er.exercise_json->'ladderSets' ELSE '[]'::jsonb END
        ) s
        WHERE (s->>'weight') ~ '^[0-9]+(\.[0-9]+)?$'
          AND (s->>'weight')::numeric > 0
      ), 0),
      COALESCE(NULLIF(er.exercise_json->>'failureWeight', '')::numeric, 0),
      COALESCE(NULLIF(er.exercise_json->>'burnoutWeight', '')::numeric, 0)
    ) AS max_weight
  FROM exercise_rows er
),

weekly_max AS (
  SELECT
    week_start, workout_type, location, exercise_name,
    MAX(max_weight) AS max_weight
  FROM session_max
  WHERE max_weight > 0
  GROUP BY week_start, workout_type, location, exercise_name
),

-- Rank weeks most-recent-first; capture current (most recent) max weight
ranked AS (
  SELECT
    exercise_name, workout_type, location, week_start, max_weight,
    ROW_NUMBER() OVER (
      PARTITION BY exercise_name, workout_type, location ORDER BY week_start DESC
    ) AS rn,
    FIRST_VALUE(max_weight) OVER (
      PARTITION BY exercise_name, workout_type, location ORDER BY week_start DESC
    ) AS current_max
  FROM weekly_max
),

-- First rank (going backwards) where weight differs from current_max
first_break AS (
  SELECT exercise_name, workout_type, location, MIN(rn) AS break_rn
  FROM ranked
  WHERE max_weight <> current_max
  GROUP BY exercise_name, workout_type, location
),

total_weeks AS (
  SELECT exercise_name, workout_type, location, MAX(rn) AS total_rn
  FROM ranked
  GROUP BY exercise_name, workout_type, location
),

pr_analysis AS (
  SELECT
    r.exercise_name,
    r.workout_type,
    r.location,
    r.current_max                                            AS current_pr_lbs,
    COALESCE(fb.break_rn - 1, tw.total_rn)                  AS weeks_at_pr,
    COALESCE(fb.break_rn - 1, tw.total_rn) >= 4             AS pr_ready,
    CURRENT_DATE                                             AS last_analyzed
  FROM ranked r
  LEFT JOIN first_break fb
    ON  fb.exercise_name = r.exercise_name
    AND fb.workout_type  = r.workout_type
    AND fb.location      IS NOT DISTINCT FROM r.location
  LEFT JOIN total_weeks tw
    ON  tw.exercise_name = r.exercise_name
    AND tw.workout_type  = r.workout_type
    AND tw.location      IS NOT DISTINCT FROM r.location
  WHERE r.rn = 1
)

INSERT INTO exercise_pr_flags
  (exercise_name, workout_type, location, current_pr_lbs, weeks_at_pr, pr_ready, last_analyzed, updated_at)
SELECT
  exercise_name,
  workout_type,
  location,
  current_pr_lbs,
  weeks_at_pr,
  pr_ready,
  last_analyzed,
  NOW()
FROM pr_analysis
ON CONFLICT (exercise_name, workout_type, (COALESCE(location, ''::text)))
DO UPDATE SET
  current_pr_lbs = EXCLUDED.current_pr_lbs,
  weeks_at_pr    = EXCLUDED.weeks_at_pr,
  pr_ready       = EXCLUDED.pr_ready,
  last_analyzed  = EXCLUDED.last_analyzed,
  updated_at     = NOW();
