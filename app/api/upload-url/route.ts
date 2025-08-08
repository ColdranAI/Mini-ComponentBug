import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const runtime = "nodejs";

function isAllowedOrigin(origin: string | null): boolean {
  const allow = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // If not configured, allow same-origin calls by default
  if (allow.length === 0) return true;
  if (!origin) return false;
  return allow.includes(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET;
  const publicBase = (process.env.PUBLIC_BUCKET_HOST || "").replace(/\/+$/, "");
  if (!region) {
    return NextResponse.json({ error: "Missing AWS_REGION env" }, { status: 500 });
  }
  if (!bucket) {
    return NextResponse.json({ error: "Missing S3_BUCKET env" }, { status: 500 });
  }
  if (!publicBase) {
    return NextResponse.json({ error: "Missing PUBLIC_BUCKET_HOST env" }, { status: 500 });
  }

  const s3 = new S3Client({ region });

  let parsed: any = {};
  try {
    parsed = await req.json();
  } catch {
    // no body provided
  }

  const contentType: string =
    typeof parsed?.contentType === "string" && parsed.contentType.length > 0
      ? parsed.contentType
      : "video/webm";

  const isWebm = contentType.toLowerCase().includes("webm");
  const ext = isWebm ? "webm" : "mp4";

  const key = `recordings/${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")}.${ext}`;

  const put = new PutObjectCommand({
    Bucket: bucket!,
    Key: key,
    ContentType: contentType,
    ACL: "public-read",
  });

  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(s3, put, { expiresIn: 60 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to presign S3 URL", detail: String(err?.message || err) },
      { status: 500 }
    );
  }

  const publicUrl = `${publicBase}/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl, key });
}


