import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

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

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}

function parseUserAgent(ua: string) {
  const isWindows = ua.includes('Windows');
  const isMac = ua.includes('Mac OS X') || ua.includes('Macintosh');
  const isLinux = ua.includes('Linux') && !ua.includes('Android');
  const isAndroid = ua.includes('Android');
  const isiOS = ua.includes('iPhone') || ua.includes('iPad');
  
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
  const isFirefox = ua.includes('Firefox');
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');
  const isEdge = ua.includes('Edg');
  
  let os = 'Unknown';
  if (isWindows) os = 'Windows';
  else if (isMac) os = 'macOS';
  else if (isLinux) os = 'Linux';
  else if (isAndroid) os = 'Android';
  else if (isiOS) os = 'iOS';
  
  let browser = 'Unknown';
  if (isChrome) browser = 'Chrome';
  else if (isFirefox) browser = 'Firefox';
  else if (isSafari) browser = 'Safari';
  else if (isEdge) browser = 'Edge';
  
  return `${browser} on ${os}`;
}

function createConciseIssueBody(params: {
  videoUrl?: string;
  infoUrl?: string;
  summary?: {
    totalNetworkRequests: number;
    failedNetworkRequests: number;
    consoleLogCount: number;
    errorLogCount: number;
  };
  pageUrl?: string;
  userAgent?: string;
  notes?: string;
}) {
  const { videoUrl, infoUrl, summary, pageUrl, userAgent, notes } = params;
  
  const lines: string[] = [];
  
  // Screen Recording
  if (videoUrl) {
    lines.push("## 📹 Screen Recording");
    lines.push(`🎬 **[View Recording](${videoUrl})**`);
    lines.push("");
  }
  
  // Quick Summary
  if (summary) {
    lines.push("## 📊 Summary");
    if (summary.failedNetworkRequests > 0) {
      lines.push(`🔴 **${summary.failedNetworkRequests}** failed requests`);
    }
    if (summary.errorLogCount > 0) {
      lines.push(`⚠️ **${summary.errorLogCount}** errors`);  
    }
    lines.push(`📡 ${summary.totalNetworkRequests} requests • 📝 ${summary.consoleLogCount} logs`);
    lines.push("");
  }
  
  // User's Description
  lines.push("## 💬 User's Words");
  lines.push(notes?.trim() || "No description provided.");
  lines.push("");
  
  // Context
  lines.push("## 🌐 Context");
  lines.push(`- **Page:** ${pageUrl ?? "N/A"}`);
  lines.push(`- **Browser:** ${userAgent ? parseUserAgent(userAgent) : "N/A"}`);
  lines.push(`- **Reported:** ${formatTimestamp(Date.now())}`);
  lines.push("");
  
  // Link to detailed information
  if (infoUrl) {
    lines.push("## 🔗 Full Details");
    lines.push(`📋 **[Complete Bug Report & Analysis](${infoUrl})**`);
    lines.push("");
    lines.push("*Detailed logs, network traces, and environment data stored in database for fast loading.*");
  }
  
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;

  if (!token || !owner || !repo) {
    console.error("❌ Missing GitHub configuration");
    return NextResponse.json(
      { error: "Missing GitHub configuration" },
      { status: 500 }
    );
  }

  try {
    const requestBody = await req.json();
    console.log("📥 Received concise issue request:", {
      title: requestBody.title,
      hasVideoUrl: !!requestBody.videoUrl,
      hasInfoUrl: !!requestBody.infoUrl,
      summary: requestBody.summary
    });

    const issueBody = createConciseIssueBody(requestBody);
    
    console.log("📏 Issue body length:", issueBody.length, "characters");
    
    if (issueBody.length > 65000) {
      console.warn("⚠️ Issue body still too long, truncating...");
      const truncated = issueBody.substring(0, 65000) + "\n\n*[Content truncated - view full details in the linked report]*";
      console.log("📏 Truncated body length:", truncated.length, "characters");
    }

    const octokit = new Octokit({ auth: token });

    const issueResponse = await octokit.rest.issues.create({
      owner,
      repo,
      title: requestBody.title || "Bug Report",
      body: issueBody.length > 65000 ? issueBody.substring(0, 65000) + "\n\n*[Content truncated]*" : issueBody,
    });

    console.log("✅ GitHub issue created:", {
      issueNumber: issueResponse.data.number,
      issueUrl: issueResponse.data.html_url,
      bodyLength: issueBody.length
    });

    return NextResponse.json({
      success: true,
      issueNumber: issueResponse.data.number,
      issueUrl: issueResponse.data.html_url,
      infoUrl: requestBody.infoUrl,
    });

  } catch (error: any) {
    console.error("❌ Failed to create GitHub issue:", error);
    return NextResponse.json(
      { error: "Failed to create GitHub issue", detail: error.message },
      { status: 500 }
    );
  }
}
