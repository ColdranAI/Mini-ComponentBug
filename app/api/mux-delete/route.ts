import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";

export const runtime = "nodejs";

function isAllowedOrigin(origin: string | null): boolean {
  const allow = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return true;
  if (!origin) return true;
  return allow.includes(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  console.log("🗑️ Mux delete - Origin:", origin);
  
  if (!isAllowedOrigin(origin)) {
    console.error("❌ Origin not allowed for mux-delete:", origin);
    return NextResponse.json({ 
      error: "Origin not allowed", 
      origin: origin,
      allowedOrigins: process.env.ALLOWED_ORIGINS || "not configured"
    }, { status: 403 });
  }

  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    console.error("❌ Missing Mux credentials");
    return NextResponse.json({ error: "Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET" }, { status: 500 });
  }

  try {
    const { playbackId } = await req.json();
    
    if (!playbackId) {
      return NextResponse.json({ error: "playbackId required" }, { status: 400 });
    }

    console.log("🗑️ Deleting Mux asset with playback ID:", playbackId);

    const mux = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
    });

    // Find the asset by playback ID
    const assets = await mux.video.assets.list();
    const asset = assets.data.find(a => 
      a.playback_ids?.some(p => p.id === playbackId)
    );

    if (asset) {
      await mux.video.assets.delete(asset.id);
      console.log("✅ Mux asset deleted:", asset.id);
      
      return NextResponse.json({
        success: true,
        deletedAssetId: asset.id,
        playbackId: playbackId
      });
    } else {
      console.log("⚠️ Asset not found for playback ID:", playbackId);
      return NextResponse.json({
        success: true,
        message: "Asset not found (may already be deleted)",
        playbackId: playbackId
      });
    }

  } catch (error: any) {
    console.error("❌ Mux delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete Mux asset", detail: error.message },
      { status: 500 }
    );
  }
}
