"use client";

import { useRecorder } from "../contexts/RecorderContext";

export default function TestApiModal() {
  const {
    testApiModalOpen,
    testApiText,
    testApiVideo,
    setTestApiModalOpen,
    setTestApiText,
    setTestApiVideo,
    testApiWithDialog,
  } = useRecorder();

  if (!testApiModalOpen) return null;

  return (
    <div 
      data-recorder-overlay="1" 
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-neutral-900/40"
    >
      <div className="bg-white border border-neutral-300 max-w-lg w-full mx-4 p-4">
        <div className="text-sm text-neutral-800 mb-4 font-medium">Test API Connection</div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-700 mb-2">Test Description</label>
            <textarea
              className="w-full min-h-[80px] border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500"
              value={testApiText}
              onChange={(e) => setTestApiText(e.target.value)}
              placeholder="Enter test description..."
            />
          </div>
          
          <div>
            <label className="block text-sm text-neutral-700 mb-2">Test Video (optional)</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setTestApiVideo(e.target.files?.[0] || null)}
              className="w-full border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500"
            />
            {testApiVideo && (
              <div className="mt-2 text-xs text-neutral-600">
                Selected: {testApiVideo.name} ({Math.round(testApiVideo.size / 1024)}KB)
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex justify-end gap-2">
          <button 
            className="px-3 py-1 bg-neutral-200 text-neutral-800 border border-neutral-300" 
            onClick={() => {
              setTestApiModalOpen(false);
              setTestApiText("");
              setTestApiVideo(null);
            }}
          >
            Cancel
          </button>
          <button 
            className="px-3 py-1 bg-green-600 text-white hover:bg-green-700" 
            onClick={testApiWithDialog}
          >
            Test API
          </button>
        </div>
      </div>
    </div>
  );
}
