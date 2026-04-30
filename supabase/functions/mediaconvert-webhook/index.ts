// Public webhook endpoint that receives MediaConvert state-change events
// from a Lambda relay. Authenticates via shared secret header, then updates
// the matching row in public.video_assets with status + final asset URLs.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type IncomingStatus =
  | "SUBMITTED"
  | "PROGRESSING"
  | "STATUS_UPDATE"
  | "COMPLETE"
  | "ERROR"
  | "CANCELED";

type DbStatus =
  | "submitted"
  | "processing"
  | "ready"
  | "failed"
  | "canceled";

const STATUS_MAP: Record<IncomingStatus, DbStatus> = {
  SUBMITTED: "submitted",
  PROGRESSING: "processing",
  STATUS_UPDATE: "processing",
  COMPLETE: "ready",
  ERROR: "failed",
  CANCELED: "canceled",
};

interface RelayPayload {
  // Required: the MediaConvert job id
  job_id: string;
  // Required: lifecycle status from MediaConvert
  status: IncomingStatus;
  // Optional: AWS error info on failure
  error_message?: string | null;
  error_code?: string | number | null;
  // Optional: pre-resolved final asset URLs (Lambda relay computes these)
  hls_url?: string | null;
  mp4_url?: string | null;
  poster_url?: string | null;
  preview_url?: string | null;
  captions_url?: string | null;
  thumbnails_vtt_url?: string | null;
  // Optional: probe data
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("MEDIACONVERT_WEBHOOK_SECRET");
  if (!expected) {
    console.error("MEDIACONVERT_WEBHOOK_SECRET is not configured");
    return json({ error: "Server misconfigured" }, 500);
  }
  const provided = req.headers.get("x-webhook-secret") ?? "";
  // Constant-time-ish compare
  if (
    provided.length !== expected.length ||
    provided !== expected
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: RelayPayload;
  try {
    payload = (await req.json()) as RelayPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!payload?.job_id || typeof payload.job_id !== "string") {
    return json({ error: "job_id is required" }, 400);
  }
  if (!payload?.status || !(payload.status in STATUS_MAP)) {
    return json({ error: "Unknown status", received: payload?.status }, 400);
  }

  const dbStatus = STATUS_MAP[payload.status];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Build patch: only set columns the relay actually provided so partial
  // PROGRESSING events don't wipe earlier values.
  const patch: Record<string, unknown> = { status: dbStatus };

  if (dbStatus === "failed") {
    patch.error_message =
      payload.error_message ??
      (payload.error_code != null
        ? `MediaConvert error code ${payload.error_code}`
        : "MediaConvert job failed");
  }

  const maybeAssign = (k: keyof RelayPayload, col: string) => {
    const v = payload[k];
    if (v !== undefined && v !== null && v !== "") patch[col] = v;
  };

  maybeAssign("hls_url", "hls_url");
  maybeAssign("mp4_url", "mp4_url");
  maybeAssign("poster_url", "poster_url");
  maybeAssign("preview_url", "preview_url");
  maybeAssign("captions_url", "captions_url");
  maybeAssign("thumbnails_vtt_url", "thumbnails_vtt_url");
  maybeAssign("duration_seconds", "duration_seconds");
  maybeAssign("width", "width");
  maybeAssign("height", "height");

  const { data, error } = await supabase
    .from("video_assets")
    .update(patch)
    .eq("mediaconvert_job_id", payload.job_id)
    .select("id, post_id, owner_id, status")
    .maybeSingle();

  if (error) {
    console.error("DB update failed", error, { job_id: payload.job_id });
    return json({ error: "DB update failed", details: error.message }, 500);
  }
  if (!data) {
    console.warn("No video_assets row for job_id", payload.job_id);
    // Return 202 so AWS doesn't retry forever for orphaned jobs
    return json({ ok: true, matched: false }, 202);
  }

  console.log("video_assets updated", {
    id: data.id,
    job_id: payload.job_id,
    status: dbStatus,
  });

  return json({ ok: true, matched: true, id: data.id, status: dbStatus });
});