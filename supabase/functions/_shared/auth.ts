// Auth gate for the nutrition-* functions.
//
// The functions run with the service role, so they ARE the access control. A valid
// Supabase session alone isn't enough: anyone can request a magic link for their own
// address and get one. The caller's email must also be in public.app_allowed_users.
//
// ENFORCE_AUTH = false is the rollout stage: a request carrying a token is still fully
// checked (bad token → 401, unknown email → 403), but a request with no token is let
// through so the deployed client keeps working until sign-in is confirmed. Flip to true.
export const ENFORCE_AUTH = false;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const CORS_ALLOW_HEADERS = 'Content-Type, Authorization, apikey, x-client-info';

const CACHE_MS = 5 * 60 * 1000;
const verdicts = new Map<string, { ok: boolean; status: number; at: number }>();

async function check(token: string): Promise<{ ok: boolean; status: number }> {
  const hit = verdicts.get(token);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  let verdict = { ok: false, status: 401 };
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${token}` },
  });
  if (userRes.ok) {
    const user = await userRes.json();
    const email = String(user?.email ?? '').trim().toLowerCase();
    verdict = { ok: false, status: 403 };
    if (email) {
      const allowRes = await fetch(
        `${SUPABASE_URL}/rest/v1/app_allowed_users?select=email&email=eq.${encodeURIComponent(email)}`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
      );
      if (!allowRes.ok) return { ok: false, status: 503 }; // don't cache a lookup failure
      if ((await allowRes.json()).length) verdict = { ok: true, status: 200 };
    }
  }
  verdicts.set(token, { ...verdict, at: Date.now() });
  return verdict;
}

// Returns a Response to send back when the caller is not allowed, or null to proceed.
export async function requireUser(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (!token) return ENFORCE_AUTH ? deny(401, 'Sign in required') : null;
  try {
    const { ok, status } = await check(token);
    if (ok) return null;
    return deny(status, status === 403 ? 'Not allowed' : status === 503 ? 'Auth check unavailable' : 'Session expired — sign in again');
  } catch {
    return deny(503, 'Auth check unavailable');
  }
}
