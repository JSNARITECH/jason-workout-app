const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Jason: 42M, 5'9" — used only as a fallback when the scale hasn't reported
// bmr_calories for the latest scan.
const HEIGHT_CM = 175;
const AGE_YEARS = 42;

const PROTEIN_TARGET_G = 225;
const NET_CARB_CEILING_G = 30;

// Calorie target = measured/estimated BMR x activity multiplier, clamped to
// the ranges from the build spec.
const REST_RANGE = { min: 2000, max: 2200, multiplier: 1.15 };
const TRAINING_RANGE = { min: 2200, max: 2400, multiplier: 1.3 };

function mifflinStJeor(weightLbs: number): number {
  const weightKg = weightLbs / 2.20462;
  return 10 * weightKg + 6.25 * HEIGHT_CM - 5 * AGE_YEARS + 5;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/body_composition?select=measurement_date,weight_lbs,bmr_calories,visceral_fat_grade&order=measurement_date.desc&limit=1`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: 'Supabase error', detail }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const rows = await res.json();
    const latest = rows[0];

    if (!latest || latest.weight_lbs == null) {
      return new Response(JSON.stringify({ error: 'No body_composition data available yet' }), {
        status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const weightLbs = Number(latest.weight_lbs);
    const bmrSource = latest.bmr_calories != null ? 'measured' : 'estimated_mifflin_st_jeor';
    const bmr = latest.bmr_calories != null ? Number(latest.bmr_calories) : Math.round(mifflinStJeor(weightLbs));

    const restTarget = Math.round(clamp(bmr * REST_RANGE.multiplier, REST_RANGE.min, REST_RANGE.max));
    const trainingTarget = Math.round(clamp(bmr * TRAINING_RANGE.multiplier, TRAINING_RANGE.min, TRAINING_RANGE.max));

    return new Response(JSON.stringify({
      measurement_date: latest.measurement_date,
      weight_lbs: weightLbs,
      visceral_fat_grade: latest.visceral_fat_grade ?? null,
      bmr_calories: bmr,
      bmr_source: bmrSource,
      protein_target_g: PROTEIN_TARGET_G,
      net_carb_ceiling_g: NET_CARB_CEILING_G,
      calorie_targets: {
        rest: { min: REST_RANGE.min, max: REST_RANGE.max, target: restTarget },
        training: { min: TRAINING_RANGE.min, max: TRAINING_RANGE.max, target: trainingTarget },
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
