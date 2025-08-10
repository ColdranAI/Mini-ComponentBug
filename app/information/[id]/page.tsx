import { notFound } from 'next/navigation';
import { db } from "../../lib/db";
import { bugReports, networkRequests, consoleLogs } from "../../lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

interface BugInfo {
  id: string;
  title: string;
  createdAt: string;
  pageUrl: string;
  userAgent: string;
  targetRegion?: any;
  capturedElements: any[];
  env?: any;
  consoleLogs: any[];
  networkRequests: any[];
  notes: string;
  videoUrl: string;
  githubIssueUrl?: string;
  githubIssueNumber?: number;
  summary: {
    totalNetworkRequests: number;
    failedNetworkRequests: number;
    consoleLogCount: number;
    errorLogCount: number;
  };
}

async function getBugInfo(infoId: string): Promise<BugInfo | null> {
  try {
    console.log("📋 Server-side fetch:", infoId);

    // Get bug report
    const [bugReport] = await db
      .select()
      .from(bugReports)
      .where(eq(bugReports.id, infoId))
      .limit(1);

    if (!bugReport) {
      return null;
    }

    // Get failed network requests (limit for performance)
    const failedRequests = await db
      .select()
      .from(networkRequests)
      .where(eq(networkRequests.bugReportId, infoId))
      .orderBy(desc(networkRequests.timestamp))
      .limit(20);

    // Get recent console logs (limit for performance) 
    const recentLogs = await db
      .select()
      .from(consoleLogs)
      .where(eq(consoleLogs.bugReportId, infoId))
      .orderBy(desc(consoleLogs.timestamp))
      .limit(100);

    // Count totals efficiently
    const [networkCount] = await db
      .select({ count: count() })
      .from(networkRequests)
      .where(eq(networkRequests.bugReportId, infoId));

    const [logCount] = await db
      .select({ count: count() })
      .from(consoleLogs)
      .where(eq(consoleLogs.bugReportId, infoId));

    // Transform to expected format
    const transformedData: BugInfo = {
      id: bugReport.id,
      title: bugReport.title,
      createdAt: bugReport.createdAt.toISOString(),
      pageUrl: bugReport.pageUrl,
      userAgent: bugReport.userAgent,
      targetRegion: bugReport.targetRegion,
      capturedElements: Array.isArray(bugReport.capturedElements) ? bugReport.capturedElements : [],
      env: bugReport.environment,
      consoleLogs: recentLogs,
      networkRequests: failedRequests,
      notes: bugReport.description,
      videoUrl: bugReport.videoUrl || '',
      githubIssueUrl: bugReport.githubIssueUrl || undefined,
      githubIssueNumber: bugReport.githubIssueNumber || undefined,
      summary: {
        totalNetworkRequests: networkCount?.count || 0,
        failedNetworkRequests: failedRequests.filter(req => req.isFailed).length,
        consoleLogCount: logCount?.count || 0,
        errorLogCount: recentLogs.filter(log => log.isError).length,
      }
    };

    console.log("✅ Server-side fetch complete");
    return transformedData;

  } catch (error: any) {
    console.error("❌ Server-side fetch failed:", error);
    return null;
  }
}

export default async function BugInformationPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: infoId } = await params;
    
    // Validate the ID format
    if (!infoId || typeof infoId !== 'string' || infoId.trim() === '') {
      notFound();
    }
    
    const bugInfo = await getBugInfo(infoId);

    if (!bugInfo) {
      notFound();
    }

  const formatTimestamp = (timestamp: string) => {
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
  };

  const parseUserAgent = (ua: string) => {
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0] || "Unknown Browser";
    const os = ua.match(/(Windows|Mac|Linux|Android|iOS)/)?.[0] || "Unknown OS";
    return `${browser} on ${os}`;
  };

  // Extract video key from new Zerops format or handle legacy Mux format
  const extractVideoInfo = (videoUrl: string) => {
    if (!videoUrl || typeof videoUrl !== 'string') {
      return { type: 'none', key: null, videoId: null };
    }
    
    // Check for new Zerops format: zerops-{base64encodedkey}-{timestamp}
    const zeropMatch = videoUrl.match(/zerops-([a-zA-Z0-9]+)-\d+$/);
    if (zeropMatch) {
      try {
        const encodedKey = zeropMatch[1].replace(/[^a-zA-Z0-9]/g, '');
        const key = atob(encodedKey);
        return { type: 'zerops', key, videoId: videoUrl };
      } catch (e) {
        console.error("Failed to decode Zerops video key:", e);
        return { type: 'invalid', key: null, videoId: null };
      }
    }
    
    // Check for legacy Mux format: mux-{playbackId}-{timestamp}
    const muxMatch = videoUrl.match(/mux-([a-zA-Z0-9]+)-\d+$/);
    if (muxMatch) {
      return { type: 'mux', key: muxMatch[1], videoId: videoUrl };
    }
    
    return { type: 'invalid', key: null, videoId: null };
  };

  const videoInfo = bugInfo.videoUrl ? extractVideoInfo(bugInfo.videoUrl) : { type: 'none', key: null, videoId: null };

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">{bugInfo.title}</h1>
              <p className="text-neutral-600">
                Bug ID: <span className="font-mono text-sm bg-neutral-100 px-2 py-1 rounded">{bugInfo.id}</span>
              </p>
              {/* GitHub Issue Reference */}
              {bugInfo.githubIssueUrl && bugInfo.githubIssueNumber && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-fit">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    <span className="font-medium">GitHub Issue:</span>
                    <a 
                      href={bugInfo.githubIssueUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-sm hover:underline"
                    >
                      #{bugInfo.githubIssueNumber}
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="text-right text-sm text-neutral-500">
              <div>📅 {formatTimestamp(bugInfo.createdAt)}</div>
              <div>🌐 {parseUserAgent(bugInfo.userAgent)}</div>
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-blue-600 font-semibold">📡 Network</div>
              <div className="text-sm">{bugInfo.summary.totalNetworkRequests} requests</div>
            </div>
            <div className="bg-red-50 p-3 rounded">
              <div className="text-red-600 font-semibold">❌ Failed</div>
              <div className="text-sm">{bugInfo.summary.failedNetworkRequests} requests</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <div className="text-yellow-600 font-semibold">📝 Logs</div>
              <div className="text-sm">{bugInfo.summary.consoleLogCount} messages</div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-orange-600 font-semibold">⚠️ Errors</div>
              <div className="text-sm">{bugInfo.summary.errorLogCount} errors</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Video & Description */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Video Player */}
            {bugInfo.videoUrl && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">🎬 Screen Recording</h2>
                
                {videoInfo.type === 'zerops' && (
                  <div className="aspect-video bg-black rounded-md overflow-hidden mb-4">
                    <video
                      controls
                      className="w-full h-full"
                    >
                      <source src={`/api/file-url?key=${encodeURIComponent(videoInfo.key!)}&direct=true`} type="video/webm" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {videoInfo.type === 'mux' && (
                  <div className="aspect-video bg-yellow-100 rounded-md overflow-hidden mb-4 flex items-center justify-center">
                    <div className="text-center text-yellow-800 p-6">
                      <div className="text-lg font-semibold mb-2">⚠️ Legacy Video Format</div>
                      <p className="text-sm mb-4">
                        This video uses the old Mux format and may no longer be available. 
                        New recordings use Zerops Object Storage for better reliability.
                      </p>
                      <a href={bugInfo.videoUrl} target="_blank" rel="noopener noreferrer" 
                         className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                        Try Opening Video Page
                      </a>
                    </div>
                  </div>
                )}

                {videoInfo.type === 'invalid' && (
                  <div className="aspect-video bg-red-100 rounded-md overflow-hidden mb-4 flex items-center justify-center">
                    <div className="text-center text-red-800 p-6">
                      <div className="text-lg font-semibold mb-2">❌ Invalid Video Format</div>
                      <p className="text-sm">
                        The video URL format is not recognized. This may be a corrupted or invalid link.
                      </p>
                    </div>
                  </div>
                )}

                {videoInfo.type === 'none' && (
                  <div className="aspect-video bg-neutral-100 rounded-md overflow-hidden mb-4 flex items-center justify-center">
                    <div className="text-center text-neutral-600 p-6">
                      <div className="text-lg font-semibold mb-2">📹 No Video</div>
                      <p className="text-sm">
                        No screen recording was captured for this bug report.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <a href={bugInfo.videoUrl} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline text-sm">
                    → Open video in dedicated page
                  </a>
                  {videoInfo.type === 'zerops' && videoInfo.key && (
                    <a 
                      href={`/api/file-url?key=${encodeURIComponent(videoInfo.key!)}&direct=true&download=true`}
                      download={`bug-recording-${bugInfo.id}.webm`}
                      className="text-green-600 hover:underline text-sm"
                    >
                      ↓ Download video
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* User Description */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">💬 User's Report</h2>
              <div className="prose prose-neutral max-w-none">
                <p className="whitespace-pre-wrap text-neutral-700">{bugInfo.notes || 'No description provided.'}</p>
              </div>
            </div>

            {/* Page Context */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">🌐 Page Context</h2>
              <div className="space-y-2 text-sm">
                <div><strong>URL:</strong> <a href={bugInfo.pageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{bugInfo.pageUrl}</a></div>
                <div><strong>User Agent:</strong> <span className="font-mono text-xs bg-neutral-100 px-2 py-1 rounded">{bugInfo.userAgent}</span></div>
                {bugInfo.targetRegion && (
                  <div><strong>Target Region:</strong> <code className="text-xs bg-neutral-100 px-2 py-1 rounded">{JSON.stringify(bugInfo.targetRegion)}</code></div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Logs & Network */}
          <div className="space-y-6">
            
            {/* Failed Requests */}
            {bugInfo.networkRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">❌ Failed Requests (Recent 20)</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bugInfo.networkRequests.map((req, index) => (
                    <div key={req.id || index} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 rounded-r">
                      <div className="font-mono text-xs font-semibold text-red-800">
                        {req.method} {req.url}
                      </div>
                      <div className="text-xs text-neutral-600 mt-1">
                        Status: {req.status || 'Network Error'} {req.statusText || ''}
                      </div>
                      {req.error && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {req.error}
                        </div>
                      )}
                      <div className="text-xs text-neutral-500 mt-1">
                        {new Date(req.timestamp).toLocaleTimeString()} • {req.duration || 0}ms
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Console Logs */}
            {bugInfo.consoleLogs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-semibold mb-4">📝 Console Logs (Recent 100)</h2>
                <div className="bg-neutral-900 text-neutral-100 p-4 rounded font-mono text-xs max-h-96 overflow-y-auto">
                  {bugInfo.consoleLogs.map((log, index) => (
                    <div key={index} className={`mb-1 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' :
                      log.level === 'info' ? 'text-blue-400' :
                      'text-neutral-300'
                    }`}>
                      [{new Date(log.timestamp).toLocaleTimeString()}] [{log.level.toUpperCase()}] {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <a href="/" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            ← Back to Bug Reporter
          </a>
        </div>
      </div>
    </div>
  );
  } catch (error: any) {
    console.error("❌ Error rendering bug information page:", error);
    notFound();
  }
}