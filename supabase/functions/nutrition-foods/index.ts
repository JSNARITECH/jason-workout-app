const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CATEGORIES = new Set(['protein', 'veg', 'supplement', 'restaurant', 'fat']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  if (req.method === 'GET') {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/foods?select=*&order=sort_order.asc,name.asc`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
      );
      if (!res.ok) {
        const detail = await res.text();
        return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const foods = await res.json();
      return new Response(JSON.stringify({ foods }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // POST — add a food Jason cooks that the seed library doesn't know about
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { name, category = 'protein', unit_label = 'serving',
              protein_g, calories, net_carbs_g = 0, is_favorite = false } = body;

      if (!name || String(name).trim().length === 0) throw new Error('name is required');
      if (protein_g == null || calories == null) throw new Error('protein_g and calories are required');
      if (!CATEGORIES.has(category)) throw new Error(`Invalid category: ${category}`);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/foods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          name: String(name).trim(),
          category,
          unit_label: String(unit_label).trim() || 'serving',
          protein_g, calories, net_carbs_g, is_favorite,
          sort_order: 500, // custom additions sort after the curated library
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const created = await res.json();
      return new Response(JSON.stringify({ food: created[0] ?? null }), {
        status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  // PATCH ?id=123  body: { is_favorite: true|false }  (long-press favorite toggle)
  if (req.method === 'PATCH') {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    try {
      const body = await req.json();
      if (typeof body.is_favorite !== 'boolean') throw new Error('is_favorite must be boolean');

      const res = await fetch(`${SUPABASE_URL}/rest/v1/foods?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ is_favorite: body.is_favorite }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
          status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const updated = await res.json();
      return new Response(JSON.stringify({ food: updated[0] ?? null }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
});
