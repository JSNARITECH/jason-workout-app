const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CATEGORIES = new Set(['protein', 'veg', 'supplement', 'restaurant', 'fat']);
const HIGH_CARB_PER_SERVING = 8;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

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

  // POST  body: { name, category?, unit_label?, default_qty?, protein_g, calories, net_carbs_g, fat_g? }
  // "Save to my foods". Macros are per ONE unit. A case-insensitive trimmed name match
  // returns the existing row instead of inserting a duplicate.
  if (req.method === 'POST') {
    try {
      const b = await req.json();
      const name = String(b.name ?? '').trim();
      if (!name) return json({ error: 'name required' }, 400);
      const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));
      const protein_g = num(b.protein_g), calories = num(b.calories), net_carbs_g = num(b.net_carbs_g);
      if (![protein_g, calories, net_carbs_g].every((n) => Number.isFinite(n) && n >= 0)) {
        return json({ error: 'protein_g, calories, net_carbs_g must be non-negative numbers' }, 400);
      }
      const category = b.category ?? 'protein';
      if (!CATEGORIES.has(category)) return json({ error: `Invalid category: ${category}` }, 400);
      const fat = b.fat_g == null ? null : num(b.fat_g);
      if (fat !== null && !(Number.isFinite(fat) && fat >= 0)) return json({ error: 'fat_g invalid' }, 400);
      const defaultQty = num(b.default_qty);

      const headers = { 'Content-Type': 'application/json', apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

      // the library is ~tens of rows; matching in JS keeps "case-insensitive trimmed" exact
      const listRes = await fetch(`${SUPABASE_URL}/rest/v1/foods?select=*`, { headers });
      if (!listRes.ok) return json({ error: 'Supabase error', detail: await listRes.text() }, 502);
      const existing = (await listRes.json()).find((f: any) => norm(f.name) === norm(name));
      if (existing) return json({ food: existing, created: false });

      const res = await fetch(`${SUPABASE_URL}/rest/v1/foods`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          name, category,
          unit_label: String(b.unit_label || 'serving').trim(),
          default_qty: Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 1,
          protein_g, calories, net_carbs_g, fat_g: fat,
          is_favorite: false,
          sort_order: 100,
          carb_flag: net_carbs_g > HIGH_CARB_PER_SERVING ? 'High carb, check serving' : null,
        }),
      });
      if (!res.ok) return json({ error: 'Supabase error', detail: await res.text() }, 502);
      const inserted = await res.json();
      return json({ food: inserted[0] ?? null, created: true }, 201);
    } catch (e) {
      return json({ error: e.message }, 400);
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
