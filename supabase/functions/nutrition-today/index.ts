const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date || !DATE_RE.test(date)) {
    return new Response(JSON.stringify({ error: 'date query param required, format YYYY-MM-DD' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/nutrition_log?log_date=eq.${date}&select=*&order=created_at.asc`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const entries = await res.json();

    const totals = entries.reduce(
      (acc: any, e: any) => {
        acc.protein_g += Number(e.protein_g) || 0;
        acc.calories += Number(e.calories) || 0;
        acc.net_carbs_g += Number(e.net_carbs_g) || 0;
        return acc;
      },
      { protein_g: 0, calories: 0, net_carbs_g: 0 }
    );

    return new Response(JSON.stringify({ date, entries, totals }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
