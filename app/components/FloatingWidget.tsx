"use client";

import { useRecorder } from "../contexts/RecorderContext";

export default function FloatingWidget() {
  const {
    recording,
    working,
    elapsed,
    selecting,
    selectedTarget,
    onStopAndUpload,
    pickAreaFlow,
    fullScreenFlow,
    setTestApiModalOpen,
  } = useRecorder();

  return (
    <div
      data-recorder-overlay="1"
      className="fixed bottom-4 right-4 z-[2147483646]"
    >
      <div className="bg-white/90 backdrop-blur-sm border border-neutral-300 shadow-sm p-2 flex gap-2 relative">
        {recording && (
          <div className="absolute -top-10 right-0 flex items-center gap-2">
            <button
              onClick={onStopAndUpload}
              disabled={working}
              className="px-3 py-1 text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {working ? "Uploading…" : "Stop"}
            </button>
            {!working && (
              <span className="text-xs text-red-700 whitespace-nowrap">{elapsed}s</span>
            )}
          </div>
        )}
        <button
          onClick={pickAreaFlow}
          disabled={selecting || !!selectedTarget || recording}
          className="px-3 py-1 text-sm bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 disabled:pointer-events-none"
        >
          Pick area
        </button>
        <button
          onClick={fullScreenFlow}
          disabled={selecting || !!selectedTarget || recording}
          className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          Full screen
        </button>
        <button
          onClick={() => setTestApiModalOpen(true)}
          disabled={recording}
          className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          Test API
        </button>
      </div>
    </div>
  );
}
