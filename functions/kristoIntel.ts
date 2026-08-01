async function kristoIntel(req: Request): Promise<Response> {
  const API_URL = "https://kristo-intelligence-api.onrender.com/agent/intelligence";
  const STATS_URL = "https://kristo-intelligence-api.onrender.com/stats";
  const RECS_URL = "https://kristo-intelligence-api.onrender.com/agent/recommendations";

  try {
    // Fetch all data in parallel
    const [intelRes, statsRes, recsRes] = await Promise.all([
      fetch(API_URL, { signal: AbortSignal.timeout(15000) }),
      fetch(STATS_URL, { signal: AbortSignal.timeout(15000) }),
      fetch(RECS_URL, { signal: AbortSignal.timeout(15000) })
    ]);

    const intel = intelRes.ok ? await intelRes.json() : { error: "intelligence endpoint unavailable" };
    const stats = statsRes.ok ? await statsRes.json() : { error: "stats endpoint unavailable" };
    const recs = recsRes.ok ? await recsRes.json() : { error: "recommendations endpoint unavailable" };

    return Response.json({
      success: true,
      intelligence: intel,
      stats: stats,
      recommendations: recs,
      fetched_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      fetched_at: new Date().toISOString()
    });
  }
}

Deno.serve(kristoIntel);
