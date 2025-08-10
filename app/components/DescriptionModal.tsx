"use client";

import { useRecorder } from "../contexts/RecorderContext";

export default function DescriptionModal() {
  const {
    descModalOpen,
    desc,
    setDesc,
    uploadStatus,
    uploadMessage,
    setUserSubmitted,
    setDescModalOpen,
  } = useRecorder();

  if (!descModalOpen) return null;

  return (
    <div 
      data-recorder-overlay="1" 
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-neutral-900/40"
    >
      <div className="bg-white border border-neutral-300 max-w-lg w-full mx-4 p-4">
        <div className="text-sm text-neutral-800 mb-2">Add a short description for the GitHub issue</div>
        <textarea
          className="w-full min-h-[128px] border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What happened? Steps to repro?"
        />
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
                className="px-3 py-1 bg-neutral-800 text-white cursor-pointer" 
                onClick={() => { 
                  setUserSubmitted(true); 
                  setDescModalOpen(false); 
                }}
              >
                Create issue
              </button>
            </>
          )}
          {uploadStatus === "uploading" && (
            <div className="text-sm text-neutral-600">Uploading...</div>
          )}
          {uploadStatus === "success" && (
            <div className="text-sm text-green-600">✓ {uploadMessage}</div>
          )}
          {uploadStatus === "error" && (
            <div className="text-sm text-red-600">✗ {uploadMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
