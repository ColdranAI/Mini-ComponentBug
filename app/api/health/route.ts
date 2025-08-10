import { NextResponse } from "next/server";
import { db, checkDatabaseConnection } from "../../lib/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("🔍 Health check starting...");

    // Test database connection
    const isConnected = await checkDatabaseConnection();
    
    if (!isConnected) {
      console.error("❌ Database connection failed");
      return NextResponse.json(
        { 
          status: "error", 
          database: "disconnected",
          message: "Database connection failed"
        },
        { status: 503 }
      );
    }

    // Test a simple query
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    
    console.log("✅ Health check passed");
    
    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      query_result: result.rows[0],
    });

  } catch (error: any) {
    console.error("❌ Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
