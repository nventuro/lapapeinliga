import { createClient } from "npm:@supabase/supabase-js@2";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const ADMIN_EMAILS = [
  "nicolas.venturo@gmail.com",
  "gustavobarbaresi@gmail.com",
];

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

async function verifyAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user?.email && ADMIN_EMAILS.includes(user.email);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify admin
  const isAdmin = await verifyAdmin(req.headers.get("Authorization"));
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
