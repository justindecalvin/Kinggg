const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
  },
});

export async function onRequest({ env }) {
  const url = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anonKey = String(env.SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    return json({ configured: false, message: "Shared Supabase settings are not configured." }, 503);
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return json({ configured: false, message: "SUPABASE_URL is invalid." }, 500);
  }

  return json({ configured: true, url, anonKey });
}
