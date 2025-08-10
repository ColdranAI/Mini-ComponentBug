import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";

function isAllowedOrigin(origin: string | null): boolean {
  const allow = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return true;
  if (!origin) return false;
  return allow.includes(origin);
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const uploadId = searchParams.get("uploadId");

  if (!uploadId) {
    return NextResponse.json({ error: "uploadId required" }, { status: 400 });
  }

  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    return NextResponse.json({ error: "Missing Mux credentials" }, { status: 500 });
  }

  try {
    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    // Get upload status
    const upload = await mux.video.uploads.retrieve(uploadId);
    
    let assetId = null;
    let playbackId = null;
    let assetStatus = null;

    // If upload is complete, get the asset details
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id);
      assetId = asset.id;
      assetStatus = asset.status;
      
      // Get the public playback ID
      if (asset.playback_ids && asset.playback_ids.length > 0) {
        const publicPlayback = asset.playback_ids.find(p => p.policy === "public");
        if (publicPlayback) {
          playbackId = publicPlayback.id;
        }
      }
    }

    console.log("📊 Mux status check:", {
      uploadId,
      uploadStatus: upload.status,
      assetId,
      assetStatus,
      playbackId,
    });

    return NextResponse.json({
      uploadId: upload.id,
      uploadStatus: upload.status,
      assetId,
      assetStatus,
      playbackId,
      ready: upload.status === "asset_created" && assetStatus === "ready" && playbackId,
    });
  } catch (error: any) {
    console.error("❌ Mux status check failed:", error);
    return NextResponse.json(
      { error: "Failed to check Mux status", detail: error.message },
      { status: 500 }
    );
  }
}
