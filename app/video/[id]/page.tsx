"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VideoPage() {
  const params = useParams();
  const videoId = params.id as string;
  const [playbackId, setPlaybackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;

    // Extract Mux playback ID from our video ID format
    // Our format: mux-{playbackId}-{timestamp}
    const match = videoId.match(/^mux-([a-zA-Z0-9]+)-\d+$/);
    if (match) {
      setPlaybackId(match[1]);
      setLoading(false);
    } else {
      setError("Invalid video ID format");
      setLoading(false);
    }
  }, [videoId]);

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

  if (error || !playbackId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Video Not Found</h1>
          <p className="text-neutral-600">{error || "Invalid video ID"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Video Player */}
          <div className="relative aspect-video bg-black">
            <video
              controls
              autoPlay
              className="w-full h-full"
              poster={`https://image.mux.com/${playbackId}/thumbnail.jpg`}
            >
              <source 
                src={`https://stream.mux.com/${playbackId}.m3u8`} 
                type="application/x-mpegURL" 
              />
              <source 
                src={`https://stream.mux.com/${playbackId}/high.mp4`} 
                type="video/mp4" 
              />
              Your browser does not support the video tag.
            </video>
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
            <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
              <span>Video ID: {videoId}</span>
              <span>Playback ID: {playbackId}</span>
              <span>Hosted by Mux</span>
            </div>

            {/* Download Options */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Download Options</h3>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://stream.mux.com/${playbackId}/high.mp4`}
                  download={`bug-recording-${videoId}.mp4`}
                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  Download MP4 (High Quality)
                </a>
                <a
                  href={`https://stream.mux.com/${playbackId}/medium.mp4`}
                  download={`bug-recording-${videoId}-medium.mp4`}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Download MP4 (Medium Quality)
                </a>
              </div>
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
