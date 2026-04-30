// Stub job submitter: creates a video_assets row tied to a post and
// returns a placeholder mediaconvert_job_id. Wire to AWS MediaConvert
// CreateJob later — the webhook contract is already in place.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BodySchema = z.object({
  source_key: z.string().min(1).max(1024),
  post_id: z.string().uuid().nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate caller
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const user = userRes.user;

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false },
  });

  // If post_id provided, confirm the user owns it
  if (body.post_id) {
    const { data: post, error: postErr } = await admin
      .from("posts")
      .select("id, author_id")
      .eq("id", body.post_id)
      .maybeSingle();
    if (postErr) return json({ error: postErr.message }, 500);
    if (!post || post.author_id !== user.id) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  // STUB: pretend we submitted to MediaConvert. Replace with real CreateJob call.
  const fakeJobId = `stub-${crypto.randomUUID()}`;

  const { data: asset, error: insErr } = await admin
    .from("video_assets")
    .insert({
      owner_id: user.id,
      post_id: body.post_id ?? null,
      source_key: body.source_key,
      mediaconvert_job_id: fakeJobId,
      status: "submitted",
    })
    .select("id, mediaconvert_job_id, status")
    .single();

  if (insErr) {
    console.error("Insert failed", insErr);
    return json({ error: insErr.message }, 500);
  }

  return json({
    ok: true,
    asset_id: asset.id,
    job_id: asset.mediaconvert_job_id,
    status: asset.status,
    note:
      "Stub job. Replace with AWS MediaConvert CreateJob; the webhook will pick up state changes by job_id.",
  });
});