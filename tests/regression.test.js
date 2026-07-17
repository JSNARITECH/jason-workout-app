'use strict';
// Required regression coverage for v13.0 schema hardening (see task doc Part 3).
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./helpers/loadApp');

const INDEX_HTML_PATH = path.join(__dirname, '..', 'index.html');
const SRC = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

// ── 1. Sprint session saves end-to-end (the 4x-regressed BUG-SPRINT-SAVE) ──
test('sprint save writes workout_type "sprint", never "cardio"', async () => {
  const ctx = loadApp();
  let capturedBody = null;
  ctx.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') capturedBody = JSON.parse(opts.body);
    return { ok: true, status: 201, text: async () => '' };
  };
  const ok = await ctx.postWorkoutToSupabase({
    workout_date: '2099-01-01',
    workout_type: 'sprint',
    location: 'Home Gym',
    exercises: [],
    duration_minutes: 21,
  });
  assert.equal(ok, true);
  assert.equal(capturedBody.workout_type, 'sprint');
  assert.notEqual(capturedBody.workout_type, 'cardio');
});

test('saveSprintWorkout call site hardcodes workout_type: "sprint"', () => {
  const sprintFn = SRC.slice(SRC.indexOf('async function saveSprintWorkout'), SRC.indexOf('async function saveSprintWorkout') + 2000);
  assert.match(sprintFn, /workout_type:\s*'sprint'/);
  assert.doesNotMatch(sprintFn, /workout_type:\s*'cardio'/);
});

// ── 2. Duplicate (date,type) insert is rejected by the DB, app offers update ──
test('409 conflict on unique (workout_date, workout_type) prompts and PATCHes instead of silently failing/duplicating', async () => {
  const ctx = loadApp();
  const calls = [];
  ctx.confirm = () => true;
  ctx.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    if (opts.method === 'POST') return { ok: false, status: 409, text: async () => 'duplicate key' };
    if (opts.method === 'PATCH') return { ok: true, status: 204, text: async () => '' };
    throw new Error('unexpected method');
  };
  const ok = await ctx.postWorkoutToSupabase({ workout_date: '2099-01-01', workout_type: 'legs', location: 'Home Gym', exercises: [] });
  assert.equal(ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].method, 'PATCH');
  assert.match(calls[1].url, /workout_date=eq\.2099-01-01/);
  assert.match(calls[1].url, /workout_type=eq\.legs/);
});

test('declining the update prompt on 409 does not silently duplicate', async () => {
  const ctx = loadApp();
  ctx.confirm = () => false;
  let patchCalled = false;
  ctx.fetch = async (url, opts) => {
    if (opts.method === 'PATCH') patchCalled = true;
    return { ok: false, status: 409, text: async () => 'duplicate key' };
  };
  const ok = await ctx.postWorkoutToSupabase({ workout_date: '2099-01-01', workout_type: 'legs', location: 'Home Gym', exercises: [] });
  assert.equal(ok, false);
  assert.equal(patchCalled, false);
});

// ── 3. Bogus duration (>240 or <1) is stored as NULL (BUG-18) ──
test('duration_minutes over 240 is nulled before it ever reaches Supabase', async () => {
  const ctx = loadApp();
  let capturedBody = null;
  ctx.fetch = async (url, opts) => { capturedBody = JSON.parse(opts.body); return { ok: true, status: 201, text: async () => '' }; };
  await ctx.postWorkoutToSupabase({ workout_date: '2099-01-01', workout_type: 'legs', location: 'Home Gym', exercises: [], duration_minutes: 1242 });
  assert.equal(capturedBody.duration_minutes, null);
});

test('a sane duration passes through untouched', async () => {
  const ctx = loadApp();
  let capturedBody = null;
  ctx.fetch = async (url, opts) => { capturedBody = JSON.parse(opts.body); return { ok: true, status: 201, text: async () => '' }; };
  await ctx.postWorkoutToSupabase({ workout_date: '2099-01-01', workout_type: 'legs', location: 'Home Gym', exercises: [], duration_minutes: 55 });
  assert.equal(capturedBody.duration_minutes, 55);
});

// ── 4. Exercise names never contain [HG]/[LT] on write ──
test('saveWorkout no longer embeds [HG]/[LT] into the exercise name', () => {
  const fn = SRC.slice(SRC.indexOf('async function saveWorkout'), SRC.indexOf('async function saveWorkout') + 4000);
  assert.match(fn, /name:\s*exSaveName/, 'expected saveWorkout to push { name: exSaveName, ... }');
  assert.doesNotMatch(fn, /\+\s*'\s*\['\s*\+\s*sessionLocation\s*\+\s*'\]'/, 'exercise name must not be tag-suffixed with sessionLocation');
});

test('no code path string-concatenates [HG]/[LT] onto an exercise name before saving', () => {
  assert.doesNotMatch(SRC, /\+\s*'\s*\['\s*\+\s*sessionLocation\s*\+\s*'\]'/);
});

// ── 5. Hassan ladder steps record 6 (or a low warm-up number) reps, never 15, on the first ladder step ──
test('every hassan:true exercise\'s first ladder set is not 15/20+ reps (the historical mislog)', () => {
  const blocks = SRC.split(/\{ id:\s*'/).slice(1); // rough per-exercise splitting
  let checked = 0;
  for (const block of blocks) {
    if (!/hassan:\s*true/.test(block.slice(0, 400))) continue;
    const setsMatch = block.match(/sets:\s*\[\{wt:\d+,\s*reps:'(\d+)'/);
    if (!setsMatch) continue;
    checked++;
    const firstReps = parseInt(setsMatch[1], 10);
    assert.ok(firstReps <= 10, `hassan exercise first ladder step logged ${firstReps} reps (expected <=10, e.g. 6) near: ${block.slice(0, 80)}`);
  }
  assert.ok(checked > 5, 'expected to find multiple hassan exercises to check');
});

// ── 6. exercise_pr_flags updates after insert, never compares PRs across locations ──
// This exercises the live M7 trigger against the actual Supabase project (same
// project the app uses). It writes a clearly-fake, future-dated row and cleans
// up after itself so it never pollutes real training history.
const SUPABASE_URL = 'https://fnjjfnsdxibjbzldfgit.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuampmbnNkeGliamJ6bGRmZ2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDM2MjAsImV4cCI6MjA4MjA3OTYyMH0.oZYn5OXKZH2h1wGfIj_R1L8Hlk3ytGFBgDCyGqUcatk';
const TEST_EXERCISE_NAME = '__REGRESSION_TEST_EXERCISE__';
const TEST_DATE_HG = '2099-06-01';
const TEST_DATE_LT = '2099-06-02';

async function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
}

async function cleanupTestRows() {
  await sb(`workouts?workout_date=in.(${TEST_DATE_HG},${TEST_DATE_LT})`, { method: 'DELETE' });
  await sb(`exercise_pr_flags?exercise_name=eq.${encodeURIComponent(TEST_EXERCISE_NAME)}`, { method: 'DELETE' });
}

test('exercise_pr_flags trigger fires on insert and keeps locations isolated', { skip: process.env.SKIP_DB_TESTS ? 'SKIP_DB_TESTS set' : false }, async (t) => {
  const reachable = await sb('workouts?limit=1').then(r => r.status !== 403 && r.status !== 0).catch(() => false);
  if (!reachable) { t.skip('Supabase project unreachable from this environment (network egress restricted)'); return; }
  await cleanupTestRows();
  try {
    const hgRes = await sb('workouts', {
      method: 'POST',
      body: JSON.stringify({
        workout_date: TEST_DATE_HG, workout_type: 'flex', location: 'Home Gym',
        exercises: [{ name: TEST_EXERCISE_NAME, type: 'straight', muscleGroup: 'test', done: true,
          sets: [{ weight: 100, reps: '10' }], failureWeight: null, burnoutWeight: null, burnoutReps: null, notes: null }],
      }),
    });
    assert.equal(hgRes.status, 201, await hgRes.text());

    const ltRes = await sb('workouts', {
      method: 'POST',
      body: JSON.stringify({
        workout_date: TEST_DATE_LT, workout_type: 'flex', location: 'Lifetime Fitness',
        exercises: [{ name: TEST_EXERCISE_NAME, type: 'straight', muscleGroup: 'test', done: true,
          sets: [{ weight: 250, reps: '10' }], failureWeight: null, burnoutWeight: null, burnoutReps: null, notes: null }],
      }),
    });
    assert.equal(ltRes.status, 201, await ltRes.text());

    const flagsRes = await sb(`exercise_pr_flags?exercise_name=eq.${encodeURIComponent(TEST_EXERCISE_NAME)}&select=location,current_pr_lbs`);
    const flags = await flagsRes.json();
    const hgFlag = flags.find(f => f.location === 'Home Gym');
    const ltFlag = flags.find(f => f.location === 'Lifetime Fitness');

    assert.ok(hgFlag, 'expected a Home Gym pr flag row to be created by the trigger');
    assert.ok(ltFlag, 'expected a Lifetime Fitness pr flag row to be created by the trigger');
    assert.equal(Number(hgFlag.current_pr_lbs), 100, 'Home Gym PR must not be inflated by the Lifetime Fitness 250lb entry');
    assert.equal(Number(ltFlag.current_pr_lbs), 250, 'Lifetime Fitness PR must not be dragged down by the Home Gym 100lb entry');
  } finally {
    await cleanupTestRows();
  }
});
