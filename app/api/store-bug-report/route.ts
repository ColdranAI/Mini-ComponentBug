import { NextRequest, NextResponse } from "next/server";
import { db, checkDatabaseConnection } from "../../lib/db";
import { bugReports, networkRequests, consoleLogs } from "../../lib/db/schema";

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
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

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

    const body = await req.json();
    const {
      title,
      pageUrl,
      userAgent,
      targetRegion,
      capturedElements,
      env,
      consoleLogs: logs,
      networkRequests: requests,
      notes,
      videoUrl,
    } = body;

    console.log("📋 Storing bug report to database...");

    // Insert bug report
    const [bugReport] = await db.insert(bugReports).values({
      title: title || "Bug Report",
      description: notes || "",
      pageUrl: pageUrl || "",
      userAgent: userAgent || "",
      videoUrl: videoUrl || null,
      targetRegion: targetRegion || null,
      capturedElements: capturedElements || null,
      environment: env || null,
    }).returning();

    console.log("✅ Bug report created:", bugReport.id);

    // Insert network requests in batches
    if (requests && requests.length > 0) {
      const networkData = requests.map((req: any) => ({
        bugReportId: bugReport.id,
        requestId: req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: req.url,
        method: req.method,
        status: req.status || null,
        statusText: req.statusText || null,
        error: req.error || null,
        duration: req.duration || null,
        timestamp: new Date(req.timestamp),
        requestHeaders: req.headers || null,
        requestBody: req.body || null,
        responseHeaders: req.responseHeaders || null,
        responseBody: req.responseBody || null,
        isFailed: Boolean((req.status && req.status >= 400) || req.error),
      }));

      // Insert in smaller batches to avoid timeout
      const batchSize = 50;
      for (let i = 0; i < networkData.length; i += batchSize) {
        const batch = networkData.slice(i, i + batchSize);
        await db.insert(networkRequests).values(batch);
      }
      
      console.log(`✅ Inserted ${networkData.length} network requests`);
    }

    // Insert console logs in batches  
    if (logs && logs.length > 0) {
      const consoleData = logs.map((log: any) => ({
        bugReportId: bugReport.id,
        level: log.level,
        message: log.message || "",
        args: log.args || null,
        timestamp: new Date(log.timestamp),
        isError: log.level === 'error',
      }));

      // Insert in smaller batches
      const batchSize = 100;
      for (let i = 0; i < consoleData.length; i += batchSize) {
        const batch = consoleData.slice(i, i + batchSize);
        await db.insert(consoleLogs).values(batch);
      }
      
      console.log(`✅ Inserted ${consoleData.length} console logs`);
    }

    // Generate summary
    const summary = {
      totalNetworkRequests: requests?.length || 0,
      failedNetworkRequests: requests?.filter((req: any) => 
        (req.status && req.status >= 400) || req.error
      ).length || 0,
      consoleLogCount: logs?.length || 0,
      errorLogCount: logs?.filter((log: any) => 
        log.level === 'error'
      ).length || 0,
    };

    const infoUrl = `${req.nextUrl.origin}/information/${bugReport.id}`;

    return NextResponse.json({
      infoId: bugReport.id,
      infoUrl,
      summary
    });

  } catch (error: any) {
    console.error("❌ Failed to store bug report:", error);
    return NextResponse.json(
      { error: "Failed to store bug report", detail: error.message },
      { status: 500 }
    );
  }
}
