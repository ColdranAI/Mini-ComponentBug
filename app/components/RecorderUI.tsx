"use client";

import { useEffect } from "react";
import { useRecorder } from "../contexts/RecorderContext";
import { RecorderOverlay } from "./RecorderOverlay";
import FloatingWidget from "./FloatingWidget";
import DescriptionModal from "./DescriptionModal";
import TestApiModal from "./TestApiModal";

export default function RecorderUI() {
  const recorder = useRecorder();

  // Handle overlay creation and cleanup
  useEffect(() => {
    recorder.overlayCleanupRef.current();
    recorder.overlayCleanupRef.current = () => {};
    recorder.overlayRef.current?.remove();
    recorder.overlayRef.current = null;

    if (!recorder.selectedTarget) return;

    const overlay = new RecorderOverlay(recorder);
    overlay.create();

    return () => {
      overlay.cleanup();
    };
  }, [recorder.selectedTarget, recorder.recording]);

  return (
    <>
      <FloatingWidget />
      <DescriptionModal />
      <TestApiModal />
    </>
  );
}
