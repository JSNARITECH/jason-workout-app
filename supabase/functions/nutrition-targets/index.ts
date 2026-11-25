import { requireUser, CORS_ALLOW_HEADERS } from '../_shared/auth.ts';
import { loadMacroConfig } from '../_shared/macro-config.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
};

// Jason: 42M, 5'9" — used only as a fallback when the scale hasn't reported
// bmr_calories for the latest scan.
const HEIGHT_CM = 175;
const AGE_YEARS = 42;

const NET_CARB_CEILING_G = 30;

// Calorie ranges, protein, fat and the recalibration weight come from app_config
// (_shared/macro-config.ts). Target = BMR x multiplier, clamped to the range.
const REST_MULT = 1.15;
const TRAINING_MULT = 1.3;

function mifflinStJeor(weightLbs: number): number {
  const weightKg = weightLbs / 2.20462;
  return 10 * weightKg + 6.25 * HEIGHT_CM - 5 * AGE_YEARS + 5;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  const denied = await requireUser(req, CORS_HEADERS);
  if (denied) return denied;
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const cfg = await loadMacroConfig();
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

    const restTarget = Math.round(clamp(bmr * REST_MULT, cfg.rest.min, cfg.rest.max));
    const trainingTarget = Math.round(clamp(bmr * TRAINING_MULT, cfg.training.min, cfg.training.max));

    return new Response(JSON.stringify({
      measurement_date: latest.measurement_date,
      weight_lbs: weightLbs,
      visceral_fat_grade: latest.visceral_fat_grade ?? null,
      bmr_calories: bmr,
      bmr_source: bmrSource,
      protein_target_g: cfg.protein_g,
      recal_weight_lbs: cfg.recal_weight_lbs,
      net_carb_ceiling_g: NET_CARB_CEILING_G,
      calorie_targets: {
        rest: { min: cfg.rest.min, max: cfg.rest.max, target: restTarget, fat_g: cfg.rest.fat_g },
        training: { min: cfg.training.min, max: cfg.training.max, target: trainingTarget, fat_g: cfg.training.fat_g },
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
