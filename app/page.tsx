"use client";

import { useRef, useState, useEffect } from "react";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import ErrorProneWidget from "@/app/components/ErrorProneWidget";
import { pickArea } from "@/app/lib/pickers";
import { createRegionController } from "@/app/lib/recorders";
import { collectRegionDiagnostics } from "@/app/lib/inspect";
import { startConsoleCapture } from "@/app/lib/telemetry";

export default function CanvasRecorderDemo() {
  const [status, setStatus] = useState("");
  const [selectedSel, setSelectedSel] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<
    | { kind: "region"; rect: DOMRect; label: string }
    | null
  >(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState("");
  const controllerRef = useRef<null | {
    start: () => void;
    stop: () => Promise<Blob>;
  }>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickAtRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayCleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: any;
    if (recording) {
      const startedAt = Date.now();
      timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 200);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    const onClick = () => {
      lastClickAtRef.current = Date.now();
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
    };
  }, []);

  // ESC resets current selection when not recording
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTarget && !recording) {
        e.preventDefault();
        resetSelection();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedTarget, recording]);

  useEffect(() => {
    overlayCleanupRef.current?.();
    overlayCleanupRef.current = () => {};
    overlayRef.current?.remove();
    overlayRef.current = null;

    if (!selectedTarget) return;

    const box = document.createElement("div");
    overlayRef.current = box;
    box.setAttribute("data-recorder-overlay", "1");
    Object.assign(box.style, {
      position: "fixed",
      zIndex: "2147483646",
      border: "2px solid #1d4ed8",
      boxShadow: "0 0 0 2px rgba(29,78,216,0.15) inset",
      background: "rgba(29,78,216,0.08)",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(box);

    if (selectedTarget.kind === "region") {
      const apply = () => {
        const r = selectedTarget.rect;
        Object.assign(box.style, {
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
      };
      apply();
      // Add floating controls attached to bottom-right of region when not recording
      let controls: HTMLDivElement | null = null;
      const ensureControls = () => {
        if (recording) return;
        if (controls) return;
        controls = document.createElement("div");
        controls.setAttribute("data-recorder-overlay", "1");
        Object.assign(controls.style, {
          position: "fixed",
          zIndex: "2147483647",
          pointerEvents: "auto",
          display: "flex",
          gap: "6px",
          alignItems: "center",
        } as CSSStyleDeclaration);
        const startBtn = document.createElement("button");
        startBtn.textContent = "Start recording";
        startBtn.onclick = () => onStartRecording();
        Object.assign(startBtn.style, {
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          fontSize: "12px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          padding: "8px 10px",
          cursor: "pointer",
        } as CSSStyleDeclaration);
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.setAttribute("aria-label", "Cancel selection");
        closeBtn.onclick = () => resetSelection();
        Object.assign(closeBtn.style, {
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          fontSize: "14px",
          lineHeight: "1",
          background: "#e5e7eb",
          color: "#111827",
          border: "1px solid #d1d5db",
          padding: "6px 8px",
          cursor: "pointer",
        } as CSSStyleDeclaration);
        controls.appendChild(startBtn);
        controls.appendChild(closeBtn);
        document.body.appendChild(controls);
      };
      const positionControls = () => {
        if (!controls) return;
        const r = selectedTarget.rect;
        const crect = controls.getBoundingClientRect();
        const left = Math.max(8, Math.floor(r.left + r.width - crect.width - 8));
        const top = Math.max(8, Math.floor(r.top + r.height - crect.height - 8));
        Object.assign(controls.style, { left: `${left}px`, top: `${top}px` } as CSSStyleDeclaration);
      };
      if (!recording) {
        ensureControls();
        // wait a tick to measure
        setTimeout(() => {
          positionControls();
        }, 0);
      }
      const onScroll = () => {
        apply();
        positionControls();
      };
      const onResize = () => {
        apply();
        positionControls();
      };
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize, true);
      overlayCleanupRef.current = () => {
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onResize, true);
        controls?.remove();
        box.remove();
      };
    }

    return () => {
      overlayCleanupRef.current?.();
      overlayCleanupRef.current = () => {};
      overlayRef.current = null;
    };
  }, [selectedTarget, recording]);

  async function onStartRecording() {
    if (!selectedTarget) return;
    setStatus("Recording…");
    setRecording(true);
    // Start console capture
    (window as any).__consoleCapture = startConsoleCapture();
    if (selectedTarget.kind === "region") {
      controllerRef.current = createRegionController(
        selectedTarget.rect,
        { fps: 8, maxSeconds: 30 },
        cursorRef as any,
        lastClickAtRef as any,
        overlayRef.current
      );
    }
    controllerRef.current?.start();
  }

  async function onStopAndUpload() {
    try {
      if (!controllerRef.current) return;
      setStatus("Finalizing recording…");
      setWorking(true);
      const blob = await controllerRef.current.stop();
      setRecording(false);
      lastBlobRef.current = blob;
      if (blob.size > 9.5 * 1024 * 1024) {
        setStatus("Too large after trim. Downloading locally…");
        downloadBlob("recording.webm", blob);
        setWorking(false);
        return;
      }
      setStatus("Uploading to S3…");
      const presignRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: blob.type }),
      });
      if (!presignRes.ok) {
        throw new Error(`presign failed: ${presignRes.status}`);
      }
      const { uploadUrl, publicUrl } = await presignRes.json();
      const putRes = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
      if (!putRes.ok) {
        throw new Error(`upload failed: ${putRes.status}`);
      }
      setStatus("Creating GitHub issue…");
      const selectorLabel = "(region)";
      const diag = collectRegionDiagnostics({
        left: Math.floor(selectedTarget!.rect.left),
        top: Math.floor(selectedTarget!.rect.top),
        width: Math.floor(selectedTarget!.rect.width),
        height: Math.floor(selectedTarget!.rect.height),
      });
      const logs = (window as any).__consoleCapture?.getLogs?.() || [];
      (window as any).__consoleCapture?.stop?.();
      const issueRes = await fetch("/api/create-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Component/Region recording (canvas)",
          videoUrl: publicUrl,
          pageUrl: location.href,
          userAgent: navigator.userAgent,
          targetRegion: diag.region,
          capturedElements: diag.elements,
          env: diag.env,
          consoleLogs: logs,
          notes,
        }),
      });
      if (!issueRes.ok) {
        throw new Error(`issue failed: ${issueRes.status}`);
      }
      const res = await issueRes.json();
      setStatus(`Done → ${res.issueUrl}`);
    } catch (e: any) {
      console.error(e);
      setRecording(false);
      setStatus(`Error: ${e.message || e}. Downloading locally…`);
      if (lastBlobRef.current) {
        downloadBlob("recording.webm", lastBlobRef.current);
      }
    }
    setWorking(false);
  }

  function downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function resetSelection() {
    setSelectedTarget(null);
    setSelectedSel(null);
    setStatus("");
  }

  async function pickAreaFlow() {
    setStatus("Draw an area…");
    const rect = await pickArea();
    setSelectedTarget({ kind: "region", rect, label: "(region)" });
    setSelectedSel("(region)");
    setStatus("Ready. Click Start Recording when you’re set.");
  }

  function fullScreenFlow() {
    const rect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    setSelectedTarget({ kind: "region", rect, label: "(full screen)" });
    setSelectedSel("(full screen)");
    setStatus("Ready. Click Start Recording when you’re set.");
  }

  return (
    <main className="p-6 max-w-4xl mx-auto pt-20">
      <h1 className="text-xl font-semibold">Component-only Recorder (Canvas)</h1>
      <p className="text-sm text-neutral-700 mt-1">
        Cross-browser element recorder using html2canvas → canvas.captureStream() → MediaRecorder.
      </p>
      <div className="flex flex-wrap gap-3 mt-4 items-center">
        {/* Main content no longer shows area/full-screen buttons; use floating widget */}

        {/* Selection actions removed from main content; handled by overlay control */}

        {/* Recording status moved beside Stop in floating widget */}

      </div>
      {status && <div className="mt-2 text-neutral-700">{status}</div>}

      <div className="mt-4 grid gap-2 max-w-xl w-full">
        <label className="text-sm text-neutral-700">Notes to include in the GitHub issue</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add repro steps, expected vs actual, etc."
          className="w-full min-h-[96px]  border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <section className="mt-6 grid gap-4">
        <div className="border border-neutral-400 p-4 bg-white">
          <h3 className="font-medium">Example component</h3>
          <p className="text-sm text-neutral-600">Hover this or anything else—your choice.</p>
          <button className="mt-2 px-3 py-1.5  bg-neutral-800 text-white">Click me</button>
        </div>
        <ErrorBoundary>
          <ErrorProneWidget />
        </ErrorBoundary>
      </section>
      {/* Floating mini widget (excluded from recording) */}
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
            className="px-3 py-1 text-sm bg-neutral-800 text-white hover:bg-neutral-900"
          >
            Pick area
          </button>
          <button
            onClick={fullScreenFlow}
            className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Full screen
          </button>
        </div>
      </div>
    </main>
  );
}

// ErrorBoundary and ErrorProneWidget moved to app/components


