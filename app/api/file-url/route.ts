import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.ZEROPS_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.ZEROPS_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.ZEROPS_S3_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const direct = searchParams.get("direct") === "true";
  const download = searchParams.get("download") === "true";
  const expiresIn = parseInt(searchParams.get("expiresIn") || "300");

  if (!key) {
    return NextResponse.json({ error: "key parameter is required" }, { status: 400 });
  }

  try {
    // Check for required environment variables
    if (!process.env.ZEROPS_S3_ENDPOINT || 
        !process.env.ZEROPS_S3_BUCKET || 
        !process.env.ZEROPS_S3_ACCESS_KEY_ID || 
        !process.env.ZEROPS_S3_SECRET_ACCESS_KEY) {
      return NextResponse.json({ 
        error: "Missing Zerops S3 configuration"
      }, { status: 500 });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.ZEROPS_S3_BUCKET!,
      Key: key,
      ...(download && { ResponseContentDisposition: `attachment; filename="video-${Date.now()}.webm"` })
    });

    const url = await getSignedUrl(s3, command, { expiresIn });

    if (direct) {
      // Redirect directly to the signed URL
      return NextResponse.redirect(url);
    }

    return NextResponse.json({ 
      url,
      key,
      expiresIn
    });
  } catch (error: any) {
    console.error("❌ Failed to create presigned download URL:", error);
    return NextResponse.json(
      { error: "Failed to create download URL", detail: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.ZEROPS_S3_ENDPOINT || 
        !process.env.ZEROPS_S3_BUCKET || 
        !process.env.ZEROPS_S3_ACCESS_KEY_ID || 
        !process.env.ZEROPS_S3_SECRET_ACCESS_KEY) {
      console.error("❌ Missing Zerops S3 credentials");
      return NextResponse.json({ 
        error: "Missing Zerops S3 configuration"
      }, { status: 500 });
    }

    const { key, expiresIn = 300 } = await req.json(); // 5 min default
    
    if (!key) {
      return NextResponse.json({ error: "key parameter is required" }, { status: 400 });
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.ZEROPS_S3_BUCKET!,
        Key: key,
      }),
      { expiresIn }
    );

    console.log("✅ Created presigned download URL:", {
      key,
      expiresIn: `${expiresIn} seconds`
    });

    return NextResponse.json({ 
      url,
      key,
      expiresIn
    });
  } catch (error: any) {
    console.error("❌ Failed to create presigned download URL:", error);
    return NextResponse.json(
      { error: "Failed to create download URL", detail: error.message },
      { status: 500 }
    );
  }
}
