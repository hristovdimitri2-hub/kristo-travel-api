/**
 * Kristo Keepalive — pings the Render API every 10 minutes to prevent
 * the free tier from sleeping. Called by a scheduled Base44 workflow.
 */
Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const targetUrl = body.url || "https://kristo-intelligence-api.onrender.com/health";

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    const statusCode = response.status;
    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text().catch(() => null);
    }

    console.log(`[Keepalive] Pinged ${targetUrl} → ${statusCode}`);

    return Response.json({
      success: statusCode === 200,
      target: targetUrl,
      status: statusCode,
      response: responseBody,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.log(`[Keepalive] Failed to ping ${targetUrl}: ${error.message}`);

    return Response.json({
      success: false,
      target: targetUrl,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
