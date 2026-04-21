// Fetch a site's live robots.txt server-side to bypass browser CORS.
// Returns { content, status, finalUrl }. Errors return { error }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (compatible; SitemapCrawlerPro/1.0)";

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

    const target = `${host}/robots.txt`;
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
