import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const COMPOUND_KEYWORDS = ['squat','press','row','pulldown','deadlift','rdl','pull'];
const HASSAN_KEYWORDS = ['hassan'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (!['GET','POST'].includes(req.method)) return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing configuration' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);
    const url = new URL(req.url);
    const weekKey = url.searchParams.get('week') || getCurrentWeekKey();

    // Fetch 8 weeks of workouts
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const startDate = eightWeeksAgo.toISOString().split('T')[0];

    const [workoutsRes, bodyCompRes, notesRes] = await Promise.all([
      client.from('workouts').select('*').gte('workout_date', startDate).order('workout_date', { ascending: true }),
      client.from('body_composition').select('measurement_date,weight_lbs,body_fat_percentage,muscle_mass_lbs,visceral_fat_grade').gte('measurement_date', startDate).order('measurement_date', { ascending: true }),
      client.from('exercise_notes').select('exercise_id,exercise_name,note_date,note').gte('note_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]),
    ]);

    const workouts = workoutsRes.data || [];
    const bodyComp = bodyCompRes.data || [];
    const notes = notesRes.data || [];

    // ── Weekly volume ──────────────────────────────────────────────
    const weeklyMap: Record<string, number> = {};
    let streak = 0;
    let lastWeek = '';

    workouts.forEach(w => {
      const isoWeek = getISOWeek(w.workout_date);
      if (!weeklyMap[isoWeek]) weeklyMap[isoWeek] = 0;
      if (w.exercises && Array.isArray(w.exercises)) {
        w.exercises.forEach((ex: any) => {
          (ex.sets || []).forEach((s: any) => {
            const wt = parseFloat(s.weight) || 0;
            const reps = parseInt(s.reps) || 0;
            weeklyMap[isoWeek] += wt * reps;
          });
        });
      }
      if (isoWeek !== lastWeek) { streak++; lastWeek = isoWeek; }
    });

    const weeklyVolume = Object.entries(weeklyMap).map(([week, volume]) => ({ week, volume: Math.round(volume) }));

    // ── Exercise progress ──────────────────────────────────────────
    const exMap: Record<string, { name: string; dataPoints: { date: string; maxWeight: number }[] }> = {};

    workouts.forEach(w => {
      if (!w.exercises || !Array.isArray(w.exercises)) return;
      w.exercises.forEach((ex: any) => {
        const name = (ex.name || '').replace(/\s*\[(HG|LT)\]$/, '').trim();
        if (!name || !ex.sets || ex.sets.length === 0) return;
        const maxWt = Math.max(...ex.sets.map((s: any) => parseFloat(s.weight) || 0).filter((v: number) => v > 0));
        if (maxWt <= 0) return;
        const key = name.toLowerCase();
        if (!exMap[key]) exMap[key] = { name, dataPoints: [] };
        exMap[key].dataPoints.push({ date: w.workout_date, maxWeight: maxWt });
      });
    });

    const exerciseProgress = Object.values(exMap)
      .filter(ex => ex.dataPoints.length >= 2)
      .map(ex => {
        const pts = ex.dataPoints;
        const first = pts[0].maxWeight;
        const last = pts[pts.length - 1].maxWeight;
        const recentPts = pts.slice(-3);
        const isPlateaued = recentPts.length >= 2 && recentPts.every(p => p.maxWeight === recentPts[0].maxWeight);
        const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
        const nameLower = ex.name.toLowerCase();
        return {
          name: ex.name,
          data_points: pts,
          trend,
          is_plateaued: isPlateaued,
          is_compound: COMPOUND_KEYWORDS.some(k => nameLower.includes(k)),
          has_hassan: HASSAN_KEYWORDS.some(k => nameLower.includes(k)),
          current_max: last,
          change_lbs: Math.round((last - first) * 10) / 10,
        };
      })
      .sort((a, b) => (b.is_compound ? 1 : 0) - (a.is_compound ? 1 : 0));

    // ── Body weight ────────────────────────────────────────────────
    const bwTrend = bodyComp.map(b => ({ date: b.measurement_date, weight: parseFloat(b.weight_lbs) || 0 }));
    const latestBW = bwTrend.length > 0 ? bwTrend[bwTrend.length - 1].weight : null;
    const earliestBW = bwTrend.length > 0 ? bwTrend[0].weight : null;
    const bwChange = (latestBW && earliestBW) ? Math.round((latestBW - earliestBW) * 10) / 10 : null;

    // ── AI insights (non-blocking — skip if no API key) ───────────
    let insights = null;
    if (ANTHROPIC_API_KEY) {
      insights = await generateInsights({
        total_workouts: workouts.length,
        exercise_count: exerciseProgress.length,
        plateaued: exerciseProgress.filter(e => e.is_plateaued).map(e => e.name),
        trending_up: exerciseProgress.filter(e => e.trend === 'up').map(e => e.name).slice(0, 3),
        bw_change: bwChange,
        latest_vf: bodyComp.length > 0 ? bodyComp[bodyComp.length - 1].visceral_fat_grade : null,
        notes: notes.slice(0, 5).map(n => `${n.exercise_name}: ${n.note}`),
      }, ANTHROPIC_API_KEY);

      // Persist to insights table
      await client.from('insights').upsert({
        week_key: weekKey,
        workout_count: workouts.length,
        latest_workout_date: workouts[workouts.length - 1]?.workout_date,
        insights_json: insights,
        raw_prompt_summary: JSON.stringify({ exerciseProgress: exerciseProgress.length, bwChange }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      total_workouts_analyzed: workouts.length,
      charts: {
        exercise_progress: exerciseProgress,
        weekly_volume: weeklyVolume,
        body_weight_trend: bwTrend,
        latest_body_weight: latestBW ? latestBW.toFixed(1) : null,
        bw_change_8_weeks: bwChange !== null ? String(bwChange) : null,
        streak,
      },
      insights,
    }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});

function getCurrentWeekKey() {
  const d = new Date();
  const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
  return weekStart.toISOString().split('T')[0];
}

function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil((((d.getTime() - startOfYear.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

async function generateInsights(data: any, apiKey: string): Promise<any> {
  const prompt = `You are Jason's fitness coach. Be direct, specific, no filler.

Data: ${JSON.stringify(data)}

Return ONLY valid JSON:
{"summary":"one sentence","highlights":["insight 1","insight 2"],"recommendations":["action 1","action 2"]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.content?.[0]?.text ?? '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}
