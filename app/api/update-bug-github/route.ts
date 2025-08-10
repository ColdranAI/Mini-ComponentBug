import { NextRequest, NextResponse } from "next/server";
import { db, checkDatabaseConnection } from "../../lib/db";
import { bugReports } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

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
      bugReportId,
      githubIssueUrl,
      githubIssueNumber,
    } = body;

    if (!bugReportId) {
      return NextResponse.json(
        { error: "Bug report ID is required" },
        { status: 400 }
      );
    }

    if (!githubIssueUrl && !githubIssueNumber) {
      return NextResponse.json(
        { error: "Either GitHub issue URL or number is required" },
        { status: 400 }
      );
    }

    console.log("🔗 Updating bug report with GitHub issue info:", {
      bugReportId,
      githubIssueUrl,
      githubIssueNumber
    });

    // Update the bug report with GitHub issue information
    const [updatedBugReport] = await db
      .update(bugReports)
      .set({
        githubIssueUrl: githubIssueUrl || null,
        githubIssueNumber: githubIssueNumber || null,
        updatedAt: new Date(),
      })
      .where(eq(bugReports.id, bugReportId))
      .returning();

    if (!updatedBugReport) {
      return NextResponse.json(
        { error: "Bug report not found" },
        { status: 404 }
      );
    }

    console.log("✅ Bug report updated with GitHub issue info:", {
      bugReportId: updatedBugReport.id,
      githubIssueUrl: updatedBugReport.githubIssueUrl,
      githubIssueNumber: updatedBugReport.githubIssueNumber
    });

    return NextResponse.json({
      success: true,
      bugReportId: updatedBugReport.id,
      githubIssueUrl: updatedBugReport.githubIssueUrl,
      githubIssueNumber: updatedBugReport.githubIssueNumber,
    });

  } catch (error: any) {
    console.error("❌ Failed to update bug report with GitHub issue:", error);
    return NextResponse.json(
      { error: "Failed to update bug report", detail: error.message },
      { status: 500 }
    );
  }
}
