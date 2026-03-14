const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const EXTRACTION_PROMPT = `You are analyzing a Samsung Health workout screenshot for Jason's workout tracker app.

Extract the following fields and return ONLY a single line of valid JSON — no markdown, no explanation, nothing else.

Required format:
{"date":"YYYY-MM-DD","duration":0,"calories":0,"avgBPM":0,"maxBPM":0,"zones":{"z1":0,"z2":0,"z3":0,"z4":0,"z5":0},"peakTiming":"mid","pattern":"steady"}

Rules:
- date: use today's date in YYYY-MM-DD format
- duration: total minutes as integer (convert HH:MM:SS → minutes, e.g. 59:20 → 59)
- calories: integer, from "Workout calories" or "Total calories"
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

  try {
    const body = await req.json();
    image = body.image;
    mediaType = body.mediaType || 'image/jpeg';
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
            { type: 'text', text: EXTRACTION_PROMPT },
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

    const data = JSON.parse(match[0]);
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
