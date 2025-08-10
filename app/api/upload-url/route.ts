import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "us-east-1", // MinIO/Zerops ignores region but SDK wants one
  endpoint: process.env.ZEROPS_S3_ENDPOINT, // e.g. https://s3-eu-central-1.zerops.io/<project-or-similar>
  forcePathStyle: true,                      // important for MinIO-style endpoints
  credentials: {
    accessKeyId: process.env.ZEROPS_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.ZEROPS_S3_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.ZEROPS_S3_ENDPOINT || 
        !process.env.ZEROPS_S3_BUCKET || 
        !process.env.ZEROPS_S3_ACCESS_KEY_ID || 
        !process.env.ZEROPS_S3_SECRET_ACCESS_KEY) {
      console.error("❌ Missing Zerops S3 credentials");
      return NextResponse.json({ 
        error: "Missing Zerops S3 configuration. Please check environment variables.",
        required: ["ZEROPS_S3_ENDPOINT", "ZEROPS_S3_BUCKET", "ZEROPS_S3_ACCESS_KEY_ID", "ZEROPS_S3_SECRET_ACCESS_KEY"]
      }, { status: 500 });
    }

    const { filename, contentType } = await req.json();
    
    // Default filename if not provided
    const finalFilename = filename || `recording-${Date.now()}.webm`;
    
    // Give each upload a folder/prefix and unique key
    const key = `recordings/${Date.now()}-${encodeURIComponent(finalFilename)}`;

    const command = new PutObjectCommand({
      Bucket: process.env.ZEROPS_S3_BUCKET!,
      Key: key,
      ContentType: contentType || "video/webm",
      // Keep bucket private - we'll serve files via signed URLs
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 }); // 5 minutes

    console.log("✅ Created presigned upload URL:", {
      key,
      contentType: contentType || "video/webm",
      expiresIn: "5 minutes"
    });

    return NextResponse.json({ 
      url, 
      key,
      bucket: process.env.ZEROPS_S3_BUCKET,
      contentType: contentType || "video/webm"
    });
  } catch (error: any) {
    console.error("❌ Failed to create presigned upload URL:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL", detail: error.message },
      { status: 500 }
    );
  }
}
