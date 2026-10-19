import { requireUser, CORS_ALLOW_HEADERS } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sbHeaders = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

// The macro tracker's slice of daily_habits — only the psyllium column. The workout
// app owns the rest of the row, and the upsert below touches only the columns it sends.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  const denied = await requireUser(req, CORS_HEADERS);
  if (denied) return denied;

  try {
    if (req.method === 'GET') {
      const date = new URL(req.url).searchParams.get('date');
      if (!date || !DATE_RE.test(date)) return json({ error: 'date query param required, format YYYY-MM-DD' }, 400);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_habits?habit_date=eq.${date}&select=psyllium`,
        { headers: sbHeaders }
      );
      if (!res.ok) return json({ error: 'Supabase error', detail: await res.text() }, 502);
      const rows = await res.json();
      return json({ date, psyllium: !!rows[0]?.psyllium });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      const date = body?.date;
      if (!date || !DATE_RE.test(date)) return json({ error: 'date required, format YYYY-MM-DD' }, 400);
      if (typeof body.psyllium !== 'boolean') return json({ error: 'psyllium must be true or false' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_habits?on_conflict=habit_date`, {
        method: 'POST',
        headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ habit_date: date, psyllium: body.psyllium, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) return json({ error: 'Supabase error', detail: await res.text() }, 502);
      return json({ date, psyllium: body.psyllium });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
