/**
 * Runtime configuration. Both values are inlined at build time.
 *
 *   NEXT_PUBLIC_API_BASE_URL  e.g. http://localhost:8000/api/v1
 *   NEXT_PUBLIC_USE_MOCK      anything but "false" → demo workspace
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

/** Health endpoints live at the API origin, outside /api/v1 (backend/api/v1/health.py). */
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "http://localhost:8000";
  }
})();

export const DATA_MODE: "demo" | "live" = USE_MOCK ? "demo" : "live";
