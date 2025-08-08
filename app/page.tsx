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
  const [selecting, setSelecting] = useState(false);
  const useStorage = ((process as any)?.env?.NEXT_PUBLIC_USE_STORAGE ?? (process as any)?.env?.USE_STORAGE) === "true";
  const [notes, setNotes] = useState("");
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [desc, setDesc] = useState("");
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
    box.className = "fixed z-[2147483646] pointer-events-none border-2 border-neutral-500 bg-neutral-200/20";
    document.body.appendChild(box);

    if (selectedTarget.kind === "region") {
      const apply = () => {
        const r = selectedTarget.label === "(full screen)"
          ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
          : selectedTarget.rect;
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
        controls.className = "fixed z-[2147483647] pointer-events-auto flex items-center gap-1";
        const startBtn = document.createElement("button");
        startBtn.textContent = "Start recording";
        startBtn.onclick = () => onStartRecording();
        startBtn.className = "px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700";
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.setAttribute("aria-label", "Cancel selection");
        closeBtn.onclick = () => resetSelection();
        closeBtn.className = "px-2 py-1 text-xs bg-neutral-300 text-neutral-800 border border-neutral-400";
        controls.appendChild(startBtn);
        controls.appendChild(closeBtn);
        document.body.appendChild(controls);
      };
      const positionControls = () => {
        if (!controls) return;
        const r = selectedTarget.label === "(full screen)"
          ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
          : selectedTarget.rect;
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
      // Open description modal (highest z-index) before uploading
      setDescModalOpen(true);
      await new Promise<void>((res) => {
        const check = () => {
          if (!descModalOpen) {
            res();
          } else {
            setTimeout(check, 50);
          }
        };
        setTimeout(check, 50);
      });

      // Decide upload strategy: small blobs inline; else S3 as before
      let publicUrl: string | null = null;
      let inlineVideo: { base64: string; contentType: string } | null = null;
      if (!useStorage || blob.size <= 1024 * 1024) {
        // inline to repo
        const arrayBuf = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
        inlineVideo = { base64, contentType: blob.type };
      } else {
        setStatus("Uploading to storage…");
        const presignRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: blob.type }),
        });
        if (!presignRes.ok) {
          throw new Error(`presign failed: ${presignRes.status}`);
        }
        const pres = await presignRes.json();
        const putRes = await fetch(pres.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
        if (!putRes.ok) {
          throw new Error(`upload failed: ${putRes.status}`);
        }
        publicUrl = pres.publicUrl;
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
          title: desc?.trim() ? desc.trim().slice(0, 120) : "User screen recording",
          videoUrl: publicUrl,
          pageUrl: location.href,
          userAgent: navigator.userAgent,
          targetRegion: diag.region,
          capturedElements: diag.elements,
          env: diag.env,
          consoleLogs: logs,
          notes: desc,
          inlineVideo,
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
    if (selecting || selectedTarget || recording || working) return;
    setSelecting(true);
    // Show a transient hint near the floating widget (excluded from recording)
    const hint = document.createElement("div");
    hint.setAttribute("data-recorder-overlay", "1");
    Object.assign(hint.style, {
      position: "fixed",
      right: "16px",
      bottom: "64px",
      zIndex: "2147483647",
      background: "rgba(219, 219, 219, 0.9)",
      color: "black",
      padding: "8px 10px",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      fontSize: "12px",
      borderRadius: "4px",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    hint.textContent = "Drag to select an area (Esc to cancel)";
    document.body.appendChild(hint);
    try {
      const rect = await pickArea();
      setSelectedTarget({ kind: "region", rect, label: "(region)" });
      setSelectedSel("(region)");
      setStatus("");
    } finally {
      hint.remove();
      setSelecting(false);
    }
  }

  function fullScreenFlow() {
    if (selecting || selectedTarget || recording || working) return;
    const rect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    setSelectedTarget({ kind: "region", rect, label: "(full screen)" });
    setSelectedSel("(full screen)");
    setStatus("");
  }

  return (
    <main className="p-6 max-w-4xl mx-auto pt-20">
      <h1 className="text-xl font-semibold">Mini Component Bug Reporter</h1>
      <p className="text-sm text-neutral-700 mt-1">
        Cross-browser element recorder using html2canvas → canvas.captureStream() → MediaRecorder.
      </p>
      <div className="flex flex-wrap gap-3 mt-4 items-center">
        {/* Main content no longer shows area/full-screen buttons; use floating widget */}

        {/* Selection actions removed from main content; handled by overlay control */}

        {/* Recording status moved beside Stop in floating widget */}

      </div>
      {status && <div className="mt-2 text-neutral-700">{status}</div>}

<textarea className="w-full min-h-[128px] border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What happened? Steps to repro?" />
      <section className="mt-6 grid gap-4">
        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Example component</h3>
          <p className="text-sm text-neutral-600">Hover this or anything else—your choice.</p>
          <button className="mt-2 px-3 py-1.5  bg-neutral-800 hover:bg-neutral-900 duration-300 hover:scale-105 text-white">Click me</button>
        </div>
        <div className="border border-neutral-300 p-4 bg-white">
          <h3 className="font-medium">Our Links</h3>
          <p className="text-sm text-neutral-600">Hover this or anything else—your choice.</p>
          <div className="flex flex-row gap-2">
          <a href="https://coldran.com/" target="_blank" className="mt-2  px-3 py-1.5  bg-black hover:bg-neutral-800 duration-300 text-white">Coldran</a>
          <a href="https://github.com/ColdranAI/Mini-ComponentBug" target="_blank" className="mt-2  px-3 py-1.5  bg-zinc-700 hover:bg-zinc-800 duration-300 text-white">Github</a>
          <a href="https://discord.gg/rDDqA83eGz" target="_blank" className="mt-2  px-3 py-1.5  bg-purple-500 hover:bg-purple-600 duration-300 text-white">Join Discord</a>
          <a href="https://x.com/ArjunS1234567890" target="_blank" className="mt-2  px-3 py-1.5  bg-neutral-900 hover:bg-neutral-800 duration-300 text-white">Follow on X</a>
          </div>
        </div>
        <ErrorBoundary>
          <ErrorProneWidget />
          <ErrorProneWidget />
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
        </div>
      </div>

      {/* Description modal (high z-index, excluded from recording) */}
      {descModalOpen && (
        <div data-recorder-overlay="1" className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-neutral-900/40">
          <div className="bg-white border border-neutral-300 max-w-lg w-full mx-4 p-4">
            <div className="text-sm text-neutral-800 mb-2">Add a short description for the GitHub issue</div>
            <textarea
              className="w-full min-h-[128px] border border-neutral-300 p-2 outline-none focus:ring-2 focus:ring-neutral-500"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What happened? Steps to repro?"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="px-3 py-1 bg-neutral-200 text-neutral-800 border border-neutral-300" onClick={() => { setDesc(""); setDescModalOpen(false); }}>Cancel</button>
              <button className="px-3 py-1 bg-neutral-800 text-white" onClick={() => setDescModalOpen(false)}>Create issue</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ErrorBoundary and ErrorProneWidget moved to app/components


