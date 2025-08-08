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
  notes?: string;
}) {
  const { videoUrl, pageUrl, userAgent, targetSelector, targetRegion, capturedElements, env, consoleLogs, notes } = params;

  const recordingSection = videoUrl.endsWith(".mp4")
    ? videoUrl
    : `[Download/Play recording](${videoUrl})`;

  const lines: string[] = [];
  lines.push("## Screen Recording", recordingSection, "");
  lines.push("## Context");
  lines.push(`- **Page:** ${pageUrl ?? "N/A"}`);
  if (targetSelector) lines.push(`- **Element:** \`${targetSelector}\``);
  if (targetRegion) lines.push(`- **Region:** left=${targetRegion.left}, top=${targetRegion.top}, width=${targetRegion.width}, height=${targetRegion.height}`);
  lines.push(`- **User-Agent:** ${userAgent ?? "N/A"}`);

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
      if (timestamp) lines.push(`- **Timestamp:** ${timestamp}`);
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

  lines.push("", "## Notes", notes?.trim() || "- (add repro steps here)");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const { title, videoUrl, pageUrl, userAgent, targetSelector, targetRegion, capturedElements, env, consoleLogs, notes, inlineVideo } =
    await req.json();

  let finalVideoUrl = videoUrl as string | undefined;
  // Optional inline video path: commit small video to repo instead of external storage
  if (!finalVideoUrl && inlineVideo && inlineVideo.base64 && inlineVideo.contentType) {
    try {
      const owner = process.env.GH_OWNER!;
      const repo = process.env.GH_REPO!;
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const ext = inlineVideo.contentType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
      const path = `issue-assets/recording-${ts}-${Math.random().toString(16).slice(2,8)}.${ext}`;
      const message = `chore(issue-assets): add recording ${ts}`;
      const resp = await octo.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path,
        message,
        content: inlineVideo.base64,
      });
      // @ts-ignore
      finalVideoUrl = resp.data.content?.download_url || resp.data.content?.html_url;
    } catch (e: any) {
      return NextResponse.json({ error: 'Failed to inline-upload video to repo', detail: String(e?.message || e) }, { status: 500 });
    }
  }

  if (!finalVideoUrl) {
    return NextResponse.json({ error: "videoUrl or inlineVideo required" }, { status: 400 });
  }

  const body = issueBodyTemplate({
    videoUrl: finalVideoUrl,
    pageUrl,
    userAgent,
    targetSelector,
    targetRegion,
    capturedElements,
    env,
    consoleLogs,
    notes,
  });

  const resp = await octo.request("POST /repos/{owner}/{repo}/issues", {
    owner: process.env.GH_OWNER!,
    repo: process.env.GH_REPO!,
    title: title || "User screen recording",
    body,
  });

  return NextResponse.json({
    issueUrl: resp.data.html_url,
    number: resp.data.number,
  });
}


