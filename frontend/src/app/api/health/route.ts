/**
 * Frontend liveness for container orchestration and the M5 stack checks.
 * Mirrors the backend's /health/live shape; it says nothing about the API
 * (the browser talks to the API directly — see Settings → Connection).
 */

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "alive",
      service: "frontend",
      dataMode: process.env.NEXT_PUBLIC_USE_MOCK !== "false" ? "demo" : "live",
      apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
