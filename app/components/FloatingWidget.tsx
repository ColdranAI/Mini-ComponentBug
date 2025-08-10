"use client";

import { useEffect, useRef } from "react";
import { useRecorder } from "../contexts/RecorderContext";

export default function FloatingWidget() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const {
    recording,
    working,
    elapsed,
    selecting,
    selectedTarget,
    onStopRecording,
    pickAreaFlow,
    fullScreenFlow,
    setTestApiModalOpen,
  } = useRecorder();

  // Ensure widget stays visible after page loads/reloads
  useEffect(() => {
    const checkVisibility = () => {
      if (widgetRef.current && !document.body.contains(widgetRef.current)) {
        console.log("FloatingWidget was removed, re-adding to body");
        document.body.appendChild(widgetRef.current);
      }
    };

    // Check immediately and then periodically
    checkVisibility();
    const interval = setInterval(checkVisibility, 1000);

    return () => clearInterval(interval);
  }, []);

  // Debug button states
  useEffect(() => {
    console.log("🔘 Button states:", {
      selecting,
      selectedTarget: !!selectedTarget,
      recording,
      working,
      buttonsDisabled: selecting || !!selectedTarget || recording
    });
  }, [selecting, selectedTarget, recording, working]);

  return (
    <div
      ref={widgetRef}
      data-recorder-widget="floating"
      className="fixed bottom-4 right-4 z-[2147483646]"
    >
      <div className="bg-white/90 backdrop-blur-sm border border-neutral-300 shadow-sm p-2 flex gap-2 relative">
        {/* Recording controls are handled in overlay */}
        <button
          onClick={pickAreaFlow}
          disabled={selecting || !!selectedTarget || recording}
          className="px-3 py-1 text-sm bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          Pick area
        </button>
        <button
          onClick={fullScreenFlow}
          disabled={selecting || !!selectedTarget || recording}
          className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          Full screen
        </button>
        <button
          onClick={() => setTestApiModalOpen(true)}
          disabled={recording}
          className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          Test API
        </button>
      </div>
    </div>
  );
}
