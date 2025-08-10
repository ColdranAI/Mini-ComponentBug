import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";

function isAllowedOrigin(origin: string | null): boolean {
  const allow = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
    
  // If no origins configured, allow all requests (development mode)
  if (allow.length === 0) return true;
  
  // Allow requests without origin (same-origin requests)
  if (!origin) return true;
  
  return allow.includes(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  console.log("🔍 Mux upload - Origin:", origin);
  
  if (!isAllowedOrigin(origin)) {
    console.error("❌ Origin not allowed for mux-upload:", origin);
    return NextResponse.json({ 
      error: "Origin not allowed", 
      origin: origin,
      allowedOrigins: process.env.ALLOWED_ORIGINS || "not configured"
    }, { status: 403 });
  }

  // Check for required Mux credentials
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    console.error("❌ Missing Mux credentials");
    return NextResponse.json({ error: "Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET" }, { status: 500 });
  }

  try {
    console.log("📤 Creating Mux direct upload URL...");

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    // Create a direct upload with public playback policy
    const upload = await mux.video.uploads.create({
      cors_origin: origin || "*",
      new_asset_settings: {
        playback_policy: ["public"],
        encoding_tier: "baseline", // Lower cost tier
      },
    });

    console.log("✅ Mux upload created:", {
      uploadId: upload.id,
      uploadUrl: upload.url,
    });

    return NextResponse.json({
      uploadId: upload.id,
      uploadUrl: upload.url,
      status: upload.status,
    });
  } catch (error: any) {
    console.error("❌ Mux upload creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create Mux upload", detail: error.message },
      { status: 500 }
    );
  }
}
