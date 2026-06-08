// Fetch a site's live robots.txt server-side to bypass browser CORS.
// Returns { content, status, finalUrl }. Errors return { error }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)";

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return new Response(
        JSON.stringify({ error: "domain is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let host = domain.trim();
    // Allow either "example.com" or "https://example.com/whatever"
    try {
      const u = new URL(host.startsWith("http") ? host : "https://" + host);
      host = u.origin;
    } catch {
      host = "https://" + host.replace(/\/+$/, "");
    }

    const targetUrl = new URL(`${host}/robots.txt`);
    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return new Response(JSON.stringify({ error: "Only http/https URLs are allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (isPrivateHost(targetUrl.hostname)) {
      return new Response(JSON.stringify({ error: "Private or internal hosts are not allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const target = targetUrl.toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(target, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/plain,*/*" },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const content = await res.text();
    return new Response(
      JSON.stringify({
        content,
        status: res.status,
        finalUrl: res.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to fetch robots.txt",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
