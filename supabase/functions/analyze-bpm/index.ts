const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// The model copies the duration text exactly as printed; the conversion to seconds happens
// in code (parseDurationToSec) — the model used to do "HH:MM:SS → minutes" itself and got it
// wrong often enough that the scanned time couldn't be trusted (FEAT-19).
function buildPrompt(today: string | null): string {
  const dateRule = today
    ? `- date: the workout date shown in the screenshot, as YYYY-MM-DD. Today is ${today}; if the year isn't printed, use the most recent such date on or before today. null if no date is shown.`
    : `- date: the workout date shown in the screenshot, as YYYY-MM-DD. null if no date is shown or the year isn't printed.`;

  return `You are analyzing a Samsung Health workout screenshot for Jason's workout tracker app.

Extract the following fields and return ONLY a single line of valid JSON — no markdown, no explanation, nothing else.

Required format:
{"date":"YYYY-MM-DD","startTime":"6:12 PM","endTime":"7:18 PM","durationText":"1:05:23","calories":0,"avgBPM":0,"maxBPM":0,"zones":{"z1":0,"z2":0,"z3":0,"z4":0,"z5":0},"peakTiming":"mid","pattern":"steady"}

Rules:
- durationText: the total workout duration copied EXACTLY as printed next to its label ("Workout time", "Total duration", "Duration", "Total time", "Exercise time") — e.g. "1:05:23", "01:05:23", "59:20". Do not convert or round it. Never read it from chart axis labels, the phone's status-bar clock, or the start/end times. null if no labeled duration is visible.
- startTime / endTime: the workout's start and end clock times if printed (e.g. "6:12 PM - 7:18 PM"), else null. Ignore the phone's status-bar clock.
${dateRule}
- calories: integer, from "Workout calories" or "Active calories"; use "Total calories" only if neither is shown
- avgBPM: integer average heart rate
- maxBPM: integer max heart rate
- zones z1–z5: percentages estimated from bar widths, must sum to 100
  - z1 = Low intensity (88–105 bpm)
  - z2 = Weight control (106–123 bpm)
  - z3 = Aerobic (124–140 bpm)
  - z4 = Anaerobic (141–158 bpm)
  - z5 = Maximum (159–176 bpm)
- peakTiming: "early" | "mid" | "late" | "multiple" — based on where BPM peaked on the chart
- pattern: "steady" | "spiky" | "gradual-rise" | "gradual-decline"
- Use null for any field not visible in the screenshot

Return ONLY the JSON. No other text.`;
}

// "1:05:23" / "01:05:23" → H:MM:SS; "59:20" → MM:SS (Samsung Health prints sub-hour
// durations without an hour field); also "1h 5m 23s", "65 min". A bare number is minutes.
function parseDurationToSec(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 60) : null;
  const s = String(v).trim().toLowerCase();
  const colon = s.match(/(\d{1,3}):(\d{2})(?::(\d{2}))?/);
  if (colon) {
    const a = Number(colon[1]), b = Number(colon[2]);
    const c = colon[3] !== undefined ? Number(colon[3]) : null;
    if (b > 59 || (c !== null && c > 59)) return null;
    const sec = c !== null ? a * 3600 + b * 60 + c : a * 60 + b;
    return sec > 0 ? sec : null;
  }
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  const sec = s.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/);
  if (h || m || sec) {
    const total = Math.round((h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0) + (sec ? Number(sec[1]) : 0));
    return total > 0 ? total : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}

// "6:12 PM" / "18:12" → minutes after midnight
function parseClockToMin(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!t) return null;
  let h = Number(t[1]);
  const min = Number(t[2]);
  if (min > 59 || h > 23) return null;
  const ap = t[3]?.replace(/\./g, '');
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'pm' && h !== 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
  }
  return h * 60 + min;
}

function formatSec(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function normalize(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...raw };

  // Duration: the labeled total wins; the model's own minutes (old prompt shape) next;
  // start→end clock span last, since it includes any paused time.
  let durationSec = parseDurationToSec(raw.durationText);
  let durationSource: string | null = durationSec ? 'label' : null;
  if (!durationSec && raw.duration !== undefined) {
    durationSec = parseDurationToSec(raw.duration);
    if (durationSec) durationSource = 'model';
  }
  if (!durationSec) {
    const start = parseClockToMin(raw.startTime), end = parseClockToMin(raw.endTime);
    if (start !== null && end !== null) {
      const span = (end - start + 1440) % 1440;
      if (span > 0) { durationSec = span * 60; durationSource = 'start-end'; }
    }
  }
  // Nothing real runs past 6 hours — treat it as a misread rather than store it
  if (durationSec && durationSec > 6 * 3600) { durationSec = null; durationSource = null; }

  out.durationSec = durationSec;
  out.durationSource = durationSource;
  out.durationText = durationSec ? (typeof raw.durationText === 'string' && durationSource === 'label' ? raw.durationText.trim() : formatSec(durationSec)) : null;
  // `duration` stays integer minutes — older clients read only this field
  out.duration = durationSec ? Math.max(1, Math.round(durationSec / 60)) : null;

  for (const k of ['calories', 'avgBPM', 'maxBPM']) {
    const n = Number(raw[k]);
    out[k] = raw[k] !== null && raw[k] !== undefined && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  if (typeof out.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(out.date as string)) out.date = null;
  for (const k of ['startTime', 'endTime']) if (typeof out[k] !== 'string') out[k] = null;
  return out;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  let image: string;
  let mediaType: string;
  let today: string | null;

  try {
    const body = await req.json();
    image = body.image;
    mediaType = body.mediaType || 'image/jpeg';
    today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
    if (!image) throw new Error('No image provided');
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Bad request: ${e.message}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image },
            },
            { type: 'text', text: buildPrompt(today) },
          ],
        }],
      }),
    });

    if (!claudeRes.ok) {
      const detail = await claudeRes.text();
      return new Response(
        JSON.stringify({ error: 'Claude API error', detail }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const claudeBody = await claudeRes.json();
    const text: string = claudeBody.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return new Response(
        JSON.stringify({ error: 'No JSON in Claude response', raw: text }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const data = normalize(JSON.parse(match[0]));
    return new Response(
      JSON.stringify(data),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
