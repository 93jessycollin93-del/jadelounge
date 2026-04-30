/**
 * Map low-level database / Supabase errors to user-safe messages.
 * Avoids leaking constraint names, table names, or schema details to the UI.
 * The original error is logged to the console for developer debugging.
 */
export function formatDbError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  // Log full error for developers; never surface it directly.
  // eslint-disable-next-line no-console
  console.error("[db error]", err);

  const e = err as { code?: string; status?: number; message?: string; name?: string };

  // Auth errors carry safe-ish messages from GoTrue, allow a curated subset.
  if (e?.name === "AuthApiError" || e?.name === "AuthError") {
    const m = (e.message || "").toLowerCase();
    if (m.includes("invalid login")) return "Invalid email or password.";
    if (m.includes("email not confirmed")) return "Please confirm your email address first.";
    if (m.includes("user already registered")) return "An account with this email already exists.";
    if (m.includes("rate limit")) return "Too many attempts. Please wait a moment and try again.";
    if (m.includes("password")) return "Password does not meet the requirements.";
    return "Authentication failed. Please try again.";
  }

  switch (e?.code) {
    case "23505":
      return "That already exists.";
    case "23503":
      return "Related item is missing or no longer available.";
    case "23502":
      return "A required field is missing.";
    case "23514":
      return "The provided value is not allowed.";
    case "22001":
      return "One of the values is too long.";
    case "22P02":
      return "Invalid value provided.";
    case "42501":
    case "PGRST301":
      return "You don't have permission to do that.";
    case "PGRST116":
      return "Item not found.";
    case "P0001":
      // RAISE EXCEPTION from a trigger — message is intentionally user-facing
      // but we still strip any 'ERRCODE' / SQL noise just in case.
      return (e.message || fallback).replace(/\bERRCODE\b.*$/i, "").trim() || fallback;
    default:
      break;
  }

  if (typeof e?.status === "number" && e.status >= 500) {
    return "Service is temporarily unavailable. Please try again.";
  }

  return fallback;
}
