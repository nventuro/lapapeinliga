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
    return new Response(JSON.stringify({ error: "Unauthorized", debug }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const s3 = getS3Client();

  try {
    if (req.method === "POST") {
      // Generate presigned upload URLs
      const { files } = await req.json() as {
        files: { key: string; contentType: string }[];
      };

      const urls = await Promise.all(
        files.map(async (file) => {
          const command = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: file.key,
            ContentType: file.contentType,
          });
          const uploadUrl = await getSignedUrl(s3, command, {
            expiresIn: PRESIGNED_URL_EXPIRY,
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
      const { keys } = await req.json() as { keys: string[] };

      await Promise.all(
        keys.map((key) =>
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
