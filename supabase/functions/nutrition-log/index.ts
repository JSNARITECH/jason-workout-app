const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MEAL_SLOTS = new Set(['meal_1', 'meal_2', 'shake', 'snack']);
const ENTRY_SOURCES = new Set(['preset', 'photo_estimate', 'manual']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: `Bad request: ${e.message}` }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const {
      log_date, meal_slot, food_id = null, food_name, quantity,
      protein_g, calories, net_carbs_g, entry_source = 'preset', notes = null,
    } = body as Record<string, any>;

    if (!log_date || !meal_slot || !food_name ||
        quantity == null || protein_g == null || calories == null || net_carbs_g == null) {
      return new Response(JSON.stringify({ error: 'Missing required field(s)' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (!MEAL_SLOTS.has(meal_slot)) {
      return new Response(JSON.stringify({ error: `Invalid meal_slot: ${meal_slot}` }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    if (!ENTRY_SOURCES.has(entry_source)) {
      return new Response(JSON.stringify({ error: `Invalid entry_source: ${entry_source}` }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nutrition_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          log_date, meal_slot, food_id, food_name, quantity,
          protein_g, calories, net_carbs_g, entry_source, notes,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const inserted = await res.json();
      return new Response(JSON.stringify({ entry: inserted[0] ?? null }), {
        status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/nutrition_log?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, Prefer: 'return=minimal' },
      });
      if (!res.ok) {
        const detail = await res.text();
        return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ deleted: id }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
});
