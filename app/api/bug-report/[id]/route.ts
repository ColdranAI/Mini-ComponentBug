import { NextRequest, NextResponse } from "next/server";
import { db, checkDatabaseConnection } from "../../../lib/db";
import { bugReports, networkRequests, consoleLogs } from "../../../lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check database connection first
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.error("❌ Database not connected");
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }

    const { id: bugReportId } = await params;

    console.log("📋 Fetching bug report:", bugReportId);

    // Get bug report
    const [bugReport] = await db
      .select()
      .from(bugReports)
      .where(eq(bugReports.id, bugReportId))
      .limit(1);

    if (!bugReport) {
      return NextResponse.json({ error: "Bug report not found" }, { status: 404 });
    }

    // Get failed network requests (limit for performance)
    const failedRequests = await db
      .select()
      .from(networkRequests)
      .where(eq(networkRequests.bugReportId, bugReportId))
      .orderBy(desc(networkRequests.timestamp))
      .limit(20); // Only get first 20 failed requests

    // Get recent console logs (limit for performance) 
    const recentLogs = await db
      .select()
      .from(consoleLogs)
      .where(eq(consoleLogs.bugReportId, bugReportId))
      .orderBy(desc(consoleLogs.timestamp))
      .limit(100); // Only get recent 100 logs

    // Get summary counts efficiently
    const [networkCount] = await db
      .select({ count: count() })
      .from(networkRequests)
      .where(eq(networkRequests.bugReportId, bugReportId));

    const [logCount] = await db
      .select({ count: count() })
      .from(consoleLogs)
      .where(eq(consoleLogs.bugReportId, bugReportId));

    // Prepare response
    const response = {
      id: bugReport.id,
      title: bugReport.title,
      description: bugReport.description,
      pageUrl: bugReport.pageUrl,
      userAgent: bugReport.userAgent,
      videoUrl: bugReport.videoUrl,
      createdAt: bugReport.createdAt,
      targetRegion: bugReport.targetRegion,
      capturedElements: bugReport.capturedElements,
      environment: bugReport.environment,
      
      // Limited data for performance
      failedNetworkRequests: failedRequests,
      recentConsoleLogs: recentLogs,
      
      // Summary
      summary: {
        totalNetworkRequests: networkCount?.count || 0,
        failedNetworkRequests: failedRequests.filter(req => req.isFailed).length,
        consoleLogCount: logCount?.count || 0,
        errorLogCount: recentLogs.filter(log => log.isError).length,
      }
    };

    console.log("✅ Bug report fetched successfully");

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("❌ Failed to fetch bug report:", error);
    return NextResponse.json(
      { error: "Failed to fetch bug report", detail: error.message },
      { status: 500 }
    );
  }
}
