import { createClient } from "npm:@supabase/supabase-js@2";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const R2_BUCKET = "lapapeinliga-media";
const R2_PUBLIC_URL = "https://pub-df9f9a703547492297599f5504e26d19.r2.dev";
const PRESIGNED_URL_EXPIRY = 900; // 15 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

// The client only ever produces these exact key shapes:
//   full/<uuid>.jpg, thumb/<uuid>.jpg, video/<uuid>.webm
// Validating server-side stops a caller (a presigned upload is open to any
// moderator) from choosing arbitrary keys — overwriting other objects, writing
// outside these prefixes — or requesting a presigned URL for an arbitrary
// content type. Without this the key is fully attacker-controlled.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
// Per-type size caps. The declared size is baked into the presigned URL as a
// signed Content-Length, so R2 rejects a PUT whose body doesn't match — the
// cap is enforced by storage, not just declared here.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const ALLOWED_UPLOADS: { keyRe: RegExp; contentType: string; maxBytes: number }[] = [
  { keyRe: new RegExp(`^full/${UUID}\\.jpg$`), contentType: "image/jpeg", maxBytes: MAX_IMAGE_BYTES },
  { keyRe: new RegExp(`^thumb/${UUID}\\.jpg$`), contentType: "image/jpeg", maxBytes: MAX_IMAGE_BYTES },
  { keyRe: new RegExp(`^video/${UUID}\\.webm$`), contentType: "video/webm", maxBytes: MAX_VIDEO_BYTES },
];
const MAX_UPLOAD_KEYS = 10;
const MAX_DELETE_KEYS = 200;
// Deletes (admin-only) may only target objects under the known prefixes — never
// a traversal or an arbitrary path.
const DELETE_KEY_RE = /^(full|thumb|video)\/[A-Za-z0-9._-]+\.(jpg|webp|png|webm)$/;

function isValidUpload(
  file: unknown,
): file is { key: string; contentType: string; size: number } {
  if (typeof file !== "object" || file === null) return false;
  const f = file as Record<string, unknown>;
  if (typeof f.key !== "string" || typeof f.contentType !== "string") return false;
  if (typeof f.size !== "number" || !Number.isInteger(f.size) || f.size <= 0) return false;
  const allowed = ALLOWED_UPLOADS.find(
    (a) => a.keyRe.test(f.key as string) && a.contentType === f.contentType,
  );
  return allowed !== undefined && (f.size as number) <= allowed.maxBytes;
}

function getS3Client(): S3Client {
  const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    },
  });
}

async function verifyRole(
  authHeader: string | null,
  rpcName: "is_admin" | "is_mod_or_admin",
): Promise<{ allowed: boolean; debug: string }> {
  if (!authHeader) return { allowed: false, debug: "No auth header" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return { allowed: false, debug: `Missing env: URL=${!!supabaseUrl}, KEY=${!!supabaseKey}` };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.rpc(rpcName);
  if (error) return { allowed: false, debug: `${rpcName} error: ${error.message}` };
  if (data !== true) return { allowed: false, debug: `${rpcName} returned ${data}` };
  return { allowed: true, debug: "ok" };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST (presigned uploads) is open to mods + admins; DELETE (R2 removal)
  // stays admin-only. RPCs hit the role table — single source of truth.
  const requiredRole = req.method === "DELETE" ? "is_admin" : "is_mod_or_admin";
  const { allowed, debug } = await verifyRole(req.headers.get("Authorization"), requiredRole);
  if (!allowed) {
    // Details go to the function logs only — the response stays generic so the
    // endpoint can't be used to probe env/config/RPC state.
    console.error(`media-upload: ${requiredRole} check failed: ${debug}`);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const s3 = getS3Client();

  try {
    if (req.method === "POST") {
      // Generate presigned upload URLs
      const { files } = await req.json() as { files: unknown };

      if (
        !Array.isArray(files) || files.length === 0 ||
        files.length > MAX_UPLOAD_KEYS || !files.every(isValidUpload)
      ) {
        return new Response(JSON.stringify({ error: "Invalid upload request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Overwrite protection: a presigned PUT for a key that already backs a
      // media row would silently replace that object's bytes. Reject any
      // request touching a key the media table already references. Uses the
      // service-role client so the check can't be affected by RLS changes.
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      // Keys are shape-validated above (hex UUIDs, no quotes/commas), so they
      // are safe to embed in a PostgREST filter list.
      const keyList = `(${files.map((f) => `"${f.key}"`).join(",")})`;
      const { data: existing, error: existingError } = await admin
        .from("media")
        .select("id")
        .or(`storage_path.in.${keyList},thumbnail_path.in.${keyList}`)
        .limit(1);
      if (existingError) {
        console.error(`media-upload: existing-key check failed: ${existingError.message}`);
        return new Response(JSON.stringify({ error: "Internal error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing !== null && existing.length > 0) {
        return new Response(JSON.stringify({ error: "Conflict" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const urls = await Promise.all(
        files.map(async (file) => {
          const command = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: file.key,
            ContentType: file.contentType,
            ContentLength: file.size,
          });
          // Signing Content-Length pins the upload to the declared size: a PUT
          // with a different body length fails R2's signature check.
          const uploadUrl = await getSignedUrl(s3, command, {
            expiresIn: PRESIGNED_URL_EXPIRY,
            signableHeaders: new Set(["content-length"]),
          });
          return {
            key: file.key,
            uploadUrl,
            publicUrl: `${R2_PUBLIC_URL}/${file.key}`,
          };
        }),
      );

      return new Response(JSON.stringify({ urls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      // Delete objects from R2
      const { keys } = await req.json() as { keys: unknown };

      if (
        !Array.isArray(keys) || keys.length === 0 || keys.length > MAX_DELETE_KEYS ||
        !keys.every((k) => typeof k === "string" && DELETE_KEY_RE.test(k))
      ) {
        return new Response(JSON.stringify({ error: "Invalid delete request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await Promise.all(
        keys.map((key: string) =>
          s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
        ),
      );

      return new Response(JSON.stringify({ deleted: keys }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log the real error; never echo internals (SDK/env details) to the caller.
    console.error("media-upload: unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
