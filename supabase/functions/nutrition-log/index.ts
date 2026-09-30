const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MEAL_SLOTS = new Set(['meal_1', 'meal_2', 'shake', 'snack']);
const ENTRY_SOURCES = new Set(['preset', 'photo_estimate', 'manual', 'saved_custom']);
const CATEGORIES = new Set(['protein', 'veg', 'supplement', 'restaurant', 'fat']);
const HIGH_CARB_PER_SERVING = 8;

const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

// "Cod fillet, 6 oz" -> Cod fillet / 6 / oz, so the saved food steps by the ounce and the
// next "Cod fillet, 8 oz" matches it. Without a trailing amount the portion is one serving.
function splitServing(raw: string) {
  const name = raw.trim().replace(/\s+/g, ' ');
  const m = name.match(/^(.+?)\s*[,(]\s*(\d+(?:\.\d+)?)\s*([a-z][a-z .]*?)\s*\)?$/i);
  if (!m || !(Number(m[2]) > 0)) return { name, qty: 1, unit: 'serving', text: 'serving' };
  const unit = m[3].trim().toLowerCase();
  // "2 scoops" -> per scoop; leave "oz", "glass" and multi-word units alone
  const singular = /^[a-z]{3,}$/.test(unit) && /[^s]s$/.test(unit) ? unit.slice(0, -1) : unit;
  return { name: m[1].trim(), qty: Number(m[2]), unit: singular, text: `${m[2]} ${unit}` };
}

// Save to my foods: link the entry to an existing food with the same name, or create one
// from the entry's own macros. Returns the food plus the entry's quantity in that food's
// units, so quantity × per-unit macros still equals what was logged and portion edits
// (Ate half, the stepper) scale from the right base.
async function saveToMyFoods(row: Record<string, any>, category: string) {
  if (!CATEGORIES.has(category)) throw new Error(`Invalid category: ${category}`);
  const qty = Number(row.quantity);
  if (!(qty > 0)) throw new Error('Quantity must be positive to save a food');

  const serving = splitServing(String(row.food_name));
  const units = qty * serving.qty;
  const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

  // the library is a few dozen rows — compare in code so the match is exactly
  // "trimmed, case-insensitive", with no ilike wildcards to escape
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/foods?select=*`, { headers });
  if (!listRes.ok) throw new Error(`foods lookup failed: ${await listRes.text()}`);
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const wanted = new Set([norm(serving.name), norm(String(row.food_name))]);
  const existing = (await listRes.json()).find((f: any) => wanted.has(norm(f.name)));

  if (existing) {
    // the library's per-unit macros won't equal this estimate; express the logged
    // amount in its units by protein (calories when either side has none)
    const p = Number(existing.protein_g), c = Number(existing.calories);
    const ratio = p > 0 && Number(row.protein_g) > 0 ? Number(row.protein_g) / p
      : c > 0 && Number(row.calories) > 0 ? Number(row.calories) / c
      : units;
    return { food: existing, existed: true, quantity: round(ratio, 2) };
  }

  const perServingCarbs = Number(row.net_carbs_g) / qty;
  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/foods`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      name: serving.name,
      category,
      unit_label: serving.unit,
      default_qty: serving.qty,
      protein_g: round(Number(row.protein_g) / units, 3),
      calories: round(Number(row.calories) / units, 3),
      net_carbs_g: round(Number(row.net_carbs_g) / units, 3),
      is_favorite: false,
      carb_flag: perServingCarbs > HIGH_CARB_PER_SERVING
        ? `High carb, check serving — ${round(perServingCarbs, 1)}g net carbs per ${serving.text}`
        : null,
      sort_order: 100,
    }),
  });
  if (!insRes.ok) throw new Error(`foods insert failed: ${await insRes.text()}`);
  const [food] = await insRes.json();
  return { food, existed: false, quantity: units };
}

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

    let {
      log_date, meal_slot, food_id = null, food_name, quantity,
      protein_g, calories, net_carbs_g, entry_source = 'preset', notes = null,
      save_as_food = null,
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

    // a failed save never costs the entry — it logs unlinked and the client says so
    let saved_food = null, save_error = null;
    if (save_as_food && food_id == null) {
      try {
        const saved = await saveToMyFoods(body as Record<string, any>, save_as_food.category ?? 'protein');
        food_id = saved.food.id;
        quantity = saved.quantity;
        entry_source = 'saved_custom';
        saved_food = { food: saved.food, existed: saved.existed };
      } catch (e) {
        save_error = e.message;
      }
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
      return new Response(JSON.stringify({ entry: inserted[0] ?? null, saved_food, save_error }), {
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
