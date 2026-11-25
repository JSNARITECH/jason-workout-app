// Macro targets live in public.app_config (key/value text) so a recalibration is a
// row update, not a deploy. Defaults below are only a fallback if a row is missing
// or unreadable; the migration seeds the same values.
//
//   macro_training_kcal   '2150-2350'   training-day calorie range (min-max)
//   macro_rest_kcal       '1950-2150'   rest-day calorie range (min-max)
//   macro_protein_g       '225'
//   macro_recal_weight    '203.6'       recalibrate targets when scale hits this (lb)
//   macro_training_fat_g  '135'         ~ guideline, not enforced
//   macro_rest_fat_g      '115'         ~ guideline, not enforced
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export interface MacroConfig {
  protein_g: number;
  recal_weight_lbs: number;
  training: { min: number; max: number; fat_g: number };
  rest: { min: number; max: number; fat_g: number };
}

const DEFAULTS: Record<string, string> = {
  macro_training_kcal: '2150-2350',
  macro_rest_kcal: '1950-2150',
  macro_protein_g: '225',
  macro_recal_weight: '203.6',
  macro_training_fat_g: '135',
  macro_rest_fat_g: '115',
};

function range(v: string, fallback: string): { min: number; max: number } {
  for (const s of [v, fallback]) {
    const m = String(s).match(/^\s*(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*$/);
    if (m && Number(m[1]) <= Number(m[2])) return { min: Number(m[1]), max: Number(m[2]) };
  }
  return { min: 0, max: 0 };
}

function num(v: string, fallback: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : Number(fallback);
}

export async function loadMacroConfig(): Promise<MacroConfig> {
  const raw: Record<string, string> = { ...DEFAULTS };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?select=key,value&key=like.macro_*`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (res.ok) for (const r of await res.json()) if (r.key in DEFAULTS) raw[r.key] = String(r.value);
  } catch { /* fall back to defaults */ }

  return {
    protein_g: num(raw.macro_protein_g, DEFAULTS.macro_protein_g),
    recal_weight_lbs: num(raw.macro_recal_weight, DEFAULTS.macro_recal_weight),
    training: { ...range(raw.macro_training_kcal, DEFAULTS.macro_training_kcal), fat_g: num(raw.macro_training_fat_g, DEFAULTS.macro_training_fat_g) },
    rest: { ...range(raw.macro_rest_kcal, DEFAULTS.macro_rest_kcal), fat_g: num(raw.macro_rest_fat_g, DEFAULTS.macro_rest_fat_g) },
  };
}
