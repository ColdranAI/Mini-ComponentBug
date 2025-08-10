import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

export const runtime = "nodejs";

const octo = new Octokit({ auth: process.env.GITHUB_TOKEN });

function isAllowedOrigin(origin: string | null): boolean {
  const allow = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // If not configured, allow same-origin calls by default
  if (allow.length === 0) return true;
  if (!origin) return false;
  return allow.includes(origin);
}

function issueBodyTemplate(params: {
  videoUrl: string;
  pageUrl?: string;
  userAgent?: string;
  targetSelector?: string;
  targetRegion?: { left: number; top: number; width: number; height: number };
  capturedElements?: Array<{
    selector: string;
    tag: string;
    id?: string;
    classes?: string[];
    role?: string | null;
    ariaLabel?: string | null;
    text?: string | null;
    rect: { left: number; top: number; width: number; height: number };
  }>;
  env?: Record<string, any>;
  consoleLogs?: Array<{ level: string; message: string; timestamp: string }>;
  networkRequests?: Array<{
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
    status?: number;
    statusText?: string;
    responseHeaders?: Record<string, string>;
    responseBody?: any;
    error?: string;
    duration?: number;
  }>;
  notes?: string;
}) {
  const { videoUrl, pageUrl, userAgent, targetSelector, targetRegion, capturedElements, env, consoleLogs, networkRequests, notes } = params;

  // Enhanced video link formatting
  const recordingSection = (() => {
    const isDirectVideo = videoUrl.endsWith(".mp4") || videoUrl.endsWith(".webm");
    const isGitHubAsset = videoUrl.includes("github.com") || videoUrl.includes("githubusercontent.com");
    
    if (isDirectVideo && isGitHubAsset) {
      // For GitHub-hosted videos, create both download link and direct embed
      return `🎥 **[Download/Play Recording](${videoUrl})**\n\n<video width="100%" controls>\n  <source src="${videoUrl}" type="video/${videoUrl.split('.').pop()}">\n  Your browser does not support the video tag.\n  [Download video](${videoUrl})\n</video>`;
    } else if (isDirectVideo) {
      // For other direct video links
      return `🎥 **[Download/Play Recording](${videoUrl})**`;
    } else {
      // For other storage URLs
      return `🎥 **[Download/Play Recording](${videoUrl})**`;
    }
  })();

  const lines: string[] = [];
  lines.push("## Screen Recording", recordingSection, "");
  lines.push("## Context");
  lines.push(`- **Page:** ${pageUrl ?? "N/A"}`);
  if (targetSelector) lines.push(`- **Element:** \`${targetSelector}\``);
  if (targetRegion) lines.push(`- **Region:** left=${targetRegion.left}, top=${targetRegion.top}, width=${targetRegion.width}, height=${targetRegion.height}`);
  // Parse user agent for better display
  const parseUserAgent = (ua: string) => {
    const isWindows = ua.includes('Windows');
    const isMac = ua.includes('Mac OS X') || ua.includes('Macintosh');
    const isLinux = ua.includes('Linux') && !ua.includes('Android');
    const isAndroid = ua.includes('Android');
    const isiOS = ua.includes('iPhone') || ua.includes('iPad');
    
    const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
    const isFirefox = ua.includes('Firefox');
    const isSafari = ua.includes('Safari') && !ua.includes('Chrome');
    const isEdge = ua.includes('Edg');
    
    let os = 'Unknown OS';
    if (isWindows) os = 'Windows';
    else if (isMac) os = 'macOS';
    else if (isiOS) os = 'iOS';
    else if (isAndroid) os = 'Android';
    else if (isLinux) os = 'Linux';
    
    let browser = 'Unknown Browser';
    if (isChrome) browser = 'Chrome';
    else if (isFirefox) browser = 'Firefox';
    else if (isSafari) browser = 'Safari';
    else if (isEdge) browser = 'Edge';
    
    return `${browser} on ${os}`;
  };

  const humanReadableUA = userAgent ? parseUserAgent(userAgent) : "N/A";
  lines.push(`- **Browser:** ${humanReadableUA}`);
  lines.push(`- **Raw User-Agent:** ${userAgent ?? "N/A"}`);

  if (env) {
    lines.push("", "## Environment");
    try {
      const { viewport, screen, language, languages, platform, timezone, pageUrl: purl, referrer, devicePixelRatio, timestamp } = (env as any) || {};
      if (viewport) lines.push(`- **Viewport:** ${viewport.width}x${viewport.height} @${viewport.devicePixelRatio ?? devicePixelRatio ?? 1}x`);
      if (screen) lines.push(`- **Screen:** ${screen.width}x${screen.height} (avail ${screen.availWidth}x${screen.availHeight})`);
      if (language) lines.push(`- **Language:** ${language} (${Array.isArray(languages) ? languages.join(', ') : ''})`);
      if (platform) lines.push(`- **Platform:** ${platform}`);
      if (timezone) lines.push(`- **Timezone:** ${timezone}`);
      if (referrer) lines.push(`- **Referrer:** ${referrer}`);
      // Format timestamp in human-readable format
      if (timestamp) {
        const humanTime = new Date(timestamp).toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit',
          timeZoneName: 'short'
        });
        lines.push(`- **Recording Time:** ${humanTime}`);
        lines.push(`- **Raw Timestamp:** ${timestamp}`);
      }
    } catch {}
  }

  if (capturedElements && capturedElements.length) {
    lines.push("", "## Elements within Region (sample)");
    for (const el of capturedElements.slice(0, 30)) {
      const meta: string[] = [];
      if (el.id) meta.push(`#${el.id}`);
      if (el.classes && el.classes.length) meta.push('.' + el.classes.slice(0, 3).join('.'));
      if (el.role) meta.push(`role=${el.role}`);
      if (el.ariaLabel) meta.push(`aria-label=\"${el.ariaLabel}\"`);
      lines.push(`- ${el.selector} (${el.tag}${meta.length ? ' ' + meta.join(' ') : ''}) [${el.rect.left},${el.rect.top},${el.rect.width}x${el.rect.height}]`);
      if (el.text) lines.push(`  - text: ${el.text}`);
    }
  }

  if (consoleLogs && consoleLogs.length) {
    lines.push("", "## Console Logs (recent)");
    const recent = consoleLogs.slice(-100);
    for (const e of recent) {
      lines.push(`- [${e.timestamp}] [${e.level}] ${e.message}`);
    }
  }

  if (networkRequests && networkRequests.length) {
    const failedRequests = networkRequests.filter(req => 
      (req.status && req.status >= 400) || req.error
    );
    
    if (failedRequests.length > 0) {
      lines.push("", "## Failed Network Requests");
      for (const req of failedRequests.slice(-20)) { // Last 20 failed requests
        const timestamp = new Date(req.timestamp).toLocaleTimeString();
        lines.push(`### ${req.method} ${req.url}`);
        lines.push(`- **Time:** ${timestamp}`);
        lines.push(`- **Status:** ${req.status || 'Network Error'} ${req.statusText || ''}`);
        if (req.duration) lines.push(`- **Duration:** ${req.duration}ms`);
        if (req.error) lines.push(`- **Error:** ${req.error}`);
        
        if (req.headers && Object.keys(req.headers).length > 0) {
          lines.push("- **Request Headers:**");
          Object.entries(req.headers).forEach(([key, value]) => {
            lines.push(`  - ${key}: ${value}`);
          });
        }
        
        if (req.body) {
          lines.push("- **Request Body:**");
          const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2);
          lines.push(`\`\`\`\n${bodyStr.slice(0, 1000)}${bodyStr.length > 1000 ? '...' : ''}\n\`\`\``);
        }
        
        if (req.responseBody) {
          lines.push("- **Response Body:**");
          const respStr = typeof req.responseBody === 'string' ? req.responseBody : JSON.stringify(req.responseBody, null, 2);
          lines.push(`\`\`\`\n${respStr.slice(0, 1000)}${respStr.length > 1000 ? '...' : ''}\n\`\`\``);
        }
        
        lines.push("");
      }
    }
    
    // Summary of all requests
    lines.push("", "## Network Request Summary");
    const successCount = networkRequests.filter(req => req.status && req.status >= 200 && req.status < 400).length;
    const errorCount = failedRequests.length;
    const totalCount = networkRequests.length;
    
    lines.push(`- **Total Requests:** ${totalCount}`);
    lines.push(`- **Successful:** ${successCount}`);
    lines.push(`- **Failed:** ${errorCount}`);
    
    if (totalCount > 0) {
      const avgDuration = networkRequests
        .filter(req => req.duration)
        .reduce((acc, req) => acc + (req.duration || 0), 0) / networkRequests.filter(req => req.duration).length;
      if (avgDuration) {
        lines.push(`- **Average Duration:** ${Math.round(avgDuration)}ms`);
      }
    }
  }

  lines.push("", "## Notes", notes?.trim() || "- (add repro steps here)");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    console.error("❌ Origin not allowed:", origin);
    return new NextResponse("forbidden", { status: 403 });
  }

  let requestBody;
  try {
    requestBody = await req.json();
  } catch (e) {
    console.error("❌ Invalid JSON in request body:", e);
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const { title, videoUrl, pageUrl, userAgent, targetSelector, targetRegion, capturedElements, env, consoleLogs, networkRequests, notes } = requestBody;

  console.log("📥 Create issue request received:", {
    title: title?.slice(0, 50) + "...",
    hasVideoUrl: !!videoUrl,
    pageUrl,
    userAgent: userAgent?.slice(0, 50) + "...",
    networkRequestsCount: networkRequests?.length || 0,
    consoleLogsCount: consoleLogs?.length || 0,
  });

  const finalVideoUrl = videoUrl as string | undefined;

  if (!finalVideoUrl) {
    console.error("❌ No video URL found after processing:", {
      hasVideoUrl: !!videoUrl,
    });
    return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
  }

  const issueBody = issueBodyTemplate({
    videoUrl: finalVideoUrl,
    pageUrl,
    userAgent,
    targetSelector,
    targetRegion,
    capturedElements,
    env,
    consoleLogs,
    networkRequests,
    notes,
  });

  try {
    console.log("📤 Creating GitHub issue:", {
      owner: process.env.GH_OWNER,
      repo: process.env.GH_REPO,
      title: title || "User screen recording",
      bodyLength: issueBody.length,
    });

    const resp = await octo.request("POST /repos/{owner}/{repo}/issues", {
      owner: process.env.GH_OWNER!,
      repo: process.env.GH_REPO!,
      title: title || "User screen recording",
      body: issueBody,
    });

    console.log("✅ GitHub issue created successfully:", {
      number: resp.data.number,
      url: resp.data.html_url,
    });

    return NextResponse.json({
      issueUrl: resp.data.html_url,
      number: resp.data.number,
    });
  } catch (error: any) {
    console.error("❌ GitHub API error:", {
      message: error.message,
      status: error.status,
      response: error.response?.data,
    });
    return NextResponse.json({ 
      error: "Failed to create GitHub issue", 
      detail: error.message 
    }, { status: 500 });
  }
}


