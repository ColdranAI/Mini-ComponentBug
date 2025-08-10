"use client";

import { useRecorder } from "../contexts/RecorderContext";

export default function DescriptionModal() {
  const {
    descModalOpen,
    desc,
    setDesc,
    title,
    setTitle,
    uploadStatus,
    uploadMessage,
    setUserSubmitted,
    setDescModalOpen,
    downloadLastRecording,
    lastBlobRef,
    preUploadedVideoUrl,
    validationError,
    createGitHubIssue,
    uploadProgress,
    onUploadToZerops,
    onCancelRecording,
  } = useRecorder();

  if (!descModalOpen) return null;

  return (
    <div 
      data-recorder-overlay="1" 
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-neutral-900/40"
    >
      <div className="bg-white border border-neutral-300 max-w-lg w-full mx-4 p-4">
        <div className="text-lg font-semibold text-neutral-800 mb-4">Create Bug Report</div>
        
        {/* Video upload progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-800 mb-2">Uploading video...</div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-blue-600 mt-1">{uploadProgress}% complete</div>
          </div>
        )}

        {/* Recording completed - show action buttons */}
        {lastBlobRef.current && !preUploadedVideoUrl && uploadProgress === 0 && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-sm font-medium text-yellow-800 mb-2">Recording Ready</div>
            <div className="text-xs text-yellow-600 mb-3">
              Size: {(lastBlobRef.current.size / 1024 / 1024).toFixed(2)}MB • 
              Format: {lastBlobRef.current.type || 'video/webm'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onUploadToZerops}
                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-sm rounded"
              >
                Upload & Continue
              </button>
              <button
                onClick={onCancelRecording}
                className="px-3 py-1.5 bg-neutral-600 text-white hover:bg-neutral-700 text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Video uploaded status */}
        {lastBlobRef.current && preUploadedVideoUrl && uploadStatus === "idle" && uploadProgress === 0 && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center justify-between">
              <div>
                            <div className="text-sm font-medium text-green-800">
              {preUploadedVideoUrl ? "Video Uploaded" : "Recording Ready"}
            </div>
                <div className="text-xs text-green-600">
                  Size: {(lastBlobRef.current.size / 1024 / 1024).toFixed(2)}MB • 
                  Format: {lastBlobRef.current.type || 'video/webm'}
                  {preUploadedVideoUrl && " • Ready for GitHub"}
                </div>
                            <div className="text-xs text-green-500 mt-1">
              Fill out the form below to create GitHub issue instantly
            </div>
            {preUploadedVideoUrl && (
              <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-50 rounded border">
                <div className="font-medium">Video Preview URL:</div>
                <a 
                  href={preUploadedVideoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline break-all"
                >
                  {preUploadedVideoUrl}
                </a>
              </div>
            )}
              </div>
              <button
                onClick={downloadLastRecording}
                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-sm cursor-pointer rounded flex items-center gap-1"
              >
                <span>↓</span>
                Download
              </button>
            </div>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="text-sm text-red-700">{validationError}</div>
          </div>
        )}
        
        {/* Title Input */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Issue Title *
          </label>
          <input
            type="text"
            className={`w-full border p-2 outline-none focus:ring-2 ${
              validationError && title.trim().length < 3
                ? 'border-red-300 focus:ring-red-500' 
                : 'border-neutral-300 focus:ring-neutral-500'
            }`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Brief title describing the bug"
          />
          <div className="text-xs text-neutral-500 mt-1">
            {title.length}/3 characters minimum
          </div>
        </div>

        {/* Description Textarea */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            User's Words *
          </label>
          <textarea
            className={`w-full min-h-[128px] border p-2 outline-none focus:ring-2 ${
              validationError && desc.trim().length < 10
                ? 'border-red-300 focus:ring-red-500' 
                : 'border-neutral-300 focus:ring-neutral-500'
            }`}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What happened? Steps to reproduce the issue? (Minimum 10 characters)"
          />
          <div className="text-xs text-neutral-500 mt-1">
            {desc.length}/10 characters minimum
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {uploadStatus === "idle" && (
            <>
              <button 
                className="px-3 py-1 bg-neutral-200 text-neutral-800 border border-neutral-300 cursor-pointer" 
                onClick={() => { 
                  setDesc(""); 
                  setUserSubmitted(false); 
                  setDescModalOpen(false); 
                }}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1 bg-neutral-800 text-white cursor-pointer hover:bg-neutral-900" 
                onClick={createGitHubIssue}
              >
                Create GitHub Issue
              </button>
            </>
          )}
        </div>
        
        {/* Status messages */}
        <div className="mt-2">
          {uploadStatus === "uploading" && (
            <div className="text-sm text-neutral-600 text-center">Uploading...</div>
          )}
          {uploadStatus === "success" && (
            <div className="text-sm text-green-600 text-center">✓ {uploadMessage}</div>
          )}
          {uploadStatus === "error" && (
            <div className="text-sm text-red-600 text-center">✗ {uploadMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
