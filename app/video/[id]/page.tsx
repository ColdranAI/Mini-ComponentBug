"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VideoPage() {
  const params = useParams();
  const videoId = params.id as string;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;

    // Check if this is a Zerops video ID
    // Our format: zerops-{base64encodedkey}-{timestamp}
    const zeropMatch = videoId.match(/^zerops-([a-zA-Z0-9]+)-\d+$/);
    if (zeropMatch) {
      try {
        // Decode the base64 key
        const key = atob(zeropMatch[1].replace(/[^a-zA-Z0-9]/g, ''));
        setVideoKey(key);
        loadZeropsVideo(key);
      } catch (e) {
        setError("Invalid video ID format");
        setLoading(false);
      }
    } else {
      // Legacy Mux format - show error with migration notice
      const muxMatch = videoId.match(/^mux-([a-zA-Z0-9]+)-\d+$/);
      if (muxMatch) {
        setError("This video uses the old Mux format and is no longer available. New recordings use Zerops Object Storage.");
        setLoading(false);
      } else {
        setError("Invalid video ID format");
        setLoading(false);
      }
    }
  }, [videoId]);

  const loadZeropsVideo = async (key: string) => {
    try {
      // Get signed URL for video playback
      const response = await fetch('/api/file-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: key,
          expiresIn: 3600, // 1 hour
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load video');
      }

      const { url } = await response.json();
      setVideoUrl(url);
      setDownloadUrl(url);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load video:', err);
      setError(err.message || 'Failed to load video');
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl) return;
    
    try {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `bug-recording-${videoId}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Video Not Found</h1>
          <p className="text-neutral-600 mb-4">{error}</p>
          <a 
            href="/" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ← Back to Bug Reporter
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen  flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Video Player */}
          <div className="relative aspect-video bg-black">
            {videoUrl ? (
              <video
                controls
                autoPlay
                className="w-full h-full"
              >
                <source src={videoUrl} type="video/webm" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-white">Loading video...</div>
              </div>
            )}
          </div>

          {/* Video Info */}
          <div className="p-6">
            <h1 className="text-xl font-semibold text-neutral-800 mb-2">
              Bug Report Recording
            </h1>
            <p className="text-neutral-600 text-sm mb-4">
              Screen recording captured for bug reporting and debugging purposes.
            </p>
            
            {/* Video Details */}
            <div className="flex flex-wrap gap-4 text-xs text-neutral-500 mb-4">
              <span>Video ID: {videoId}</span>
              {videoKey && <span>Storage Key: {videoKey}</span>}
              <span>Hosted by Zerops Object Storage</span>
            </div>

            {/* Download Options */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Download Options</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!downloadUrl}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download Video (.webm)
                </button>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    Open in New Tab
                  </a>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Download links expire after 1 hour for security purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <a 
            href="/" 
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Bug Reporter
          </a>
        </div>
      </div>
    </div>
  );
}
