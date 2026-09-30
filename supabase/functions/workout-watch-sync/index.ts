// FEAT-19: pushes Galaxy Watch numbers onto an already-saved workouts row.
// The app's insert uses `resolution=ignore-duplicates` on (workout_date, workout_type), and anon
// has no UPDATE policy — so a screenshot scanned after the first save (or a row that the
// export/import flow created first) never picked up the watch duration. This function is the
// narrow write path: it can only touch the four watch columns of one (date, type) row.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const WORKOUT_TYPES = new Set(['upper', 'push', 'pull', 'legs', 'arms', 'flex', 'sprint', 'recovery']);

// Ranges mirror the workouts CHECK constraints (duration_minutes_sane) plus physiological bounds;
// anything outside is dropped rather than failing the whole sync.
const FIELDS: Record<string, [number, number]> = {
  duration_minutes: [1, 240],
  avg_heart_rate: [40, 230],
  max_heart_rate: [40, 240],
  calories_burned: [1, 5000],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('expected a JSON object');
  } catch (e) {
    return json({ error: `Bad request: ${e.message}` }, 400);
  }

  const { workout_date, workout_type } = body as Record<string, any>;
  if (typeof workout_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(workout_date)) {
    return json({ error: 'workout_date must be YYYY-MM-DD' }, 400);
  }
  if (!WORKOUT_TYPES.has(workout_type)) {
    return json({ error: `Invalid workout_type: ${workout_type}` }, 400);
  }

  const patch: Record<string, number> = {};
  const skipped: string[] = [];
  for (const [field, [lo, hi]] of Object.entries(FIELDS)) {
    const v = body[field];
    if (v === null || v === undefined || v === '') continue;
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= lo && n <= hi) patch[field] = n;
    else skipped.push(field);
  }
  if (!Object.keys(patch).length) return json({ error: 'No valid watch fields to sync', skipped }, 400);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/workouts?workout_date=eq.${workout_date}&workout_type=eq.${workout_type}&select=id`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) return json({ error: 'Supabase error', detail: await res.text() }, 502);
    const rows = await res.json();
    return json({ updated: Array.isArray(rows) ? rows.length : 0, fields: Object.keys(patch), skipped });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
