const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PROTEIN_TARGET_G = 225;
const NET_CARB_CEILING_G = 30;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days')) || 30));
  const since = isoDateDaysAgo(days - 1);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/nutrition_log?log_date=gte.${since}&select=log_date,protein_g,calories,net_carbs_g&order=log_date.asc`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const rows = await res.json();

    const byDate = new Map<string, { protein_g: number; calories: number; net_carbs_g: number }>();
    for (const r of rows) {
      const d = byDate.get(r.log_date) ?? { protein_g: 0, calories: 0, net_carbs_g: 0 };
      d.protein_g += Number(r.protein_g) || 0;
      d.calories += Number(r.calories) || 0;
      d.net_carbs_g += Number(r.net_carbs_g) || 0;
      byDate.set(r.log_date, d);
    }

    const daily = Array.from(byDate.entries())
      .map(([log_date, totals]) => ({ log_date, ...totals }))
      .sort((a, b) => a.log_date.localeCompare(b.log_date));

    const loggedDays = daily.length;
    const proteinHits = daily.filter((d) => d.protein_g >= PROTEIN_TARGET_G).length;
    const overCarbCeiling = daily.filter((d) => d.net_carbs_g > NET_CARB_CEILING_G).length;
    const avgCalories = loggedDays
      ? Math.round(daily.reduce((sum, d) => sum + d.calories, 0) / loggedDays)
      : 0;

    return new Response(JSON.stringify({
      days,
      since,
      daily,
      summary: {
        logged_days: loggedDays,
        protein_hit_rate: loggedDays ? proteinHits / loggedDays : 0,
        avg_calories: avgCalories,
        days_over_carb_ceiling: overCarbCeiling,
        protein_target_g: PROTEIN_TARGET_G,
        net_carb_ceiling_g: NET_CARB_CEILING_G,
      },
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
