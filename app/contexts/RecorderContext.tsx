"use client";

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { pickArea } from "@/app/lib/pickers";
import { createRegionController } from "@/app/lib/recorders";
import { collectRegionDiagnostics } from "@/app/lib/inspect";
import { startConsoleCapture } from "@/app/lib/telemetry";
import { startNetworkMonitoring, stopNetworkMonitoring, type NetworkRequest } from "@/app/lib/network-monitor";
import { createClientFullUrl } from "@/app/lib/url-utils";

export interface RecorderState {
  status: string;
  selectedSel: string | null;
  selectedTarget: { kind: "region"; rect: DOMRect; label: string } | null;
  recording: boolean;
  elapsed: number;
  working: boolean;
  selecting: boolean;
  descModalOpen: boolean;
  desc: string;
  title: string;
  userSubmitted: boolean;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadMessage: string;
  testApiModalOpen: boolean;
  testApiTitle: string;
  testApiText: string;
  testApiVideo: File | null;
  preUploadedVideoUrl: string | null;
  validationError: string;
  uploadProgress: number;
  githubIssueUrl: string | null;
}

export interface RecorderRefs {
  overlayRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayCleanupRef: React.MutableRefObject<() => void>;
  controllerRef: React.MutableRefObject<null | { start: () => void; stop: () => Promise<Blob> }>;
  lastBlobRef: React.MutableRefObject<Blob | null>;
  cursorRef: React.MutableRefObject<{ x: number; y: number }>;
  lastClickAtRef: React.MutableRefObject<number | null>;
  networkRequestsRef: React.MutableRefObject<NetworkRequest[]>;
  consoleLogsRef: React.MutableRefObject<any[]>;
}

export interface RecorderActions {
  setStatus: (status: string) => void;
  setSelectedSel: (sel: string | null) => void;
  setSelectedTarget: (target: { kind: "region"; rect: DOMRect; label: string } | null) => void;
  setRecording: (recording: boolean) => void;
  setElapsed: (elapsed: number) => void;
  setWorking: (working: boolean) => void;
  setSelecting: (selecting: boolean) => void;
  setDescModalOpen: (open: boolean) => void;
  setDesc: (desc: string) => void;
  setTitle: (title: string) => void;
  setUserSubmitted: (submitted: boolean) => void;
  setUploadStatus: (status: "idle" | "uploading" | "success" | "error") => void;
  setUploadMessage: (message: string) => void;
  setTestApiModalOpen: (open: boolean) => void;
  setTestApiTitle: (title: string) => void;
  setTestApiText: (text: string) => void;
  setTestApiVideo: (file: File | null) => void;
  setPreUploadedVideoUrl: (url: string | null) => void;
  setValidationError: (error: string) => void;
  setUploadProgress: (progress: number) => void;
  setGithubIssueUrl: (url: string | null) => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onUploadToZerops: () => Promise<void>;
  onCancelRecording: () => Promise<void>;
  resetSelection: () => void;
  resetGitHubState: () => void;
  pickAreaFlow: () => Promise<void>;
  fullScreenFlow: () => void;
  testApiWithDialog: () => Promise<void>;
  downloadLastRecording: () => void;
  createGitHubIssue: () => Promise<void>;
}

export type RecorderContextType = RecorderState & RecorderActions & RecorderRefs;

const RecorderContext = createContext<RecorderContextType | undefined>(undefined);

export const useRecorder = () => {
  const context = useContext(RecorderContext);
  if (context === undefined) {
    throw new Error("useRecorder must be used within a RecorderProvider");
  }
  return context;
};

interface RecorderProviderProps {
  children: ReactNode;
}

export const RecorderProvider: React.FC<RecorderProviderProps> = ({ children }) => {
  // State
  const [status, setStatus] = useState("");
  const [selectedSel, setSelectedSel] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{ kind: "region"; rect: DOMRect; label: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [working, setWorking] = useState(false);
  const [selecting, setSelecting] = useState(false);

  const [descModalOpen, setDescModalOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [title, setTitle] = useState("");
  const [userSubmitted, setUserSubmitted] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [testApiModalOpen, setTestApiModalOpen] = useState(false);
  const [testApiTitle, setTestApiTitle] = useState("");
  const [testApiText, setTestApiText] = useState("");
  const [testApiVideo, setTestApiVideo] = useState<File | null>(null);
  const [preUploadedVideoUrl, setPreUploadedVideoUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [githubIssueUrl, setGithubIssueUrl] = useState<string | null>(null);

  // Refs
  const networkRequestsRef = useRef<NetworkRequest[]>([]);
  const consoleLogsRef = useRef<any[]>([]);
  const controllerRef = useRef<null | { start: () => void; stop: () => Promise<Blob> }>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickAtRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayCleanupRef = useRef<() => void>(() => {});


  useEffect(() => {
    // On mount, ensure clean state and remove stray overlays (but preserve the floating widget)
    try {
      document.querySelectorAll('[data-recorder-overlay="1"]:not([data-recorder-widget])').forEach((el) => {
        try { (el as HTMLElement).remove(); } catch {}
      });
    } catch {}
    setRecording(false);
    setSelecting(false);
    setSelectedTarget(null);
    setSelectedSel(null);
    setStatus("");
  }, []);

  // Check for ongoing recording on mount
  useEffect(() => {
    const savedRecordingState = localStorage.getItem('bug-reporter-recording');
    if (savedRecordingState) {
      try {
        const state = JSON.parse(savedRecordingState);
        if (state.isRecording && state.startTime) {
          setRecording(true);
          setStatus("Recording in progress (cross-page)...");
          const elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
          setElapsed(elapsedTime);
          
          if (state.region) {
            const rect = new DOMRect(state.region.left, state.region.top, state.region.width, state.region.height);
            setSelectedTarget({ kind: "region", rect, label: state.region.label || "(cross-page region)" });
            setSelectedSel(state.region.label || "(cross-page region)");
          }
        }
      } catch (e) {
        localStorage.removeItem('bug-reporter-recording');
      }
    }
  }, []);

  // Timer effect for elapsed time
  useEffect(() => {
    let timer: any;
    if (recording) {
      const savedState = localStorage.getItem('bug-reporter-recording');
      let startedAt: number;
      
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          startedAt = state.startTime || Date.now();
        } catch {
          startedAt = Date.now();
        }
      } else {
        startedAt = Date.now();
      }
      
      const recordingState = {
        isRecording: true,
        startTime: startedAt,
        region: selectedTarget ? {
          left: selectedTarget.rect.left,
          top: selectedTarget.rect.top,
          width: selectedTarget.rect.width,
          height: selectedTarget.rect.height,
          label: selectedTarget.label
        } : null
      };
      localStorage.setItem('bug-reporter-recording', JSON.stringify(recordingState));
      
      // Set initial elapsed time
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      
      // Update timer more frequently for smoother counting
      timer = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(newElapsed);
        console.log("⏱️ Recording time:", newElapsed + "s");
      }, 100); // Update every 100ms for smooth counting
    } else {
      setElapsed(0);
      localStorage.removeItem('bug-reporter-recording');
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording, selectedTarget]);

  // Mouse and keyboard event handlers
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

  // ESC key handler
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

  // Actions
  const onStartRecording = async () => {
    if (!selectedTarget) return;
    
    try {
      setStatus("Recording…");
      setRecording(true);
      setUserSubmitted(false);
      
      console.log("🎬 Starting recording...", { 
        browser: navigator.userAgent, 
        target: selectedTarget 
      });
      
      (window as any).__consoleCapture = startConsoleCapture();
      startNetworkMonitoring();
      
      if (selectedTarget.kind === "region") {
        controllerRef.current = createRegionController(
          selectedTarget.rect,
          { fps: 30, maxSeconds: 120, maxBytes: 100 * 1024 * 1024 }, // Ultra quality: 30 FPS, 2 minutes, 100MB
          cursorRef as any,
          lastClickAtRef as any,
          overlayRef.current
        );
      }
      
      await controllerRef.current?.start();
      console.log("✅ Recording started successfully");
    } catch (error: any) {
      console.error("❌ Failed to start recording:", error);
      setRecording(false);
      setStatus(`Recording failed: ${error.message || "Browser not supported"}`);
      
      // Reset selection so user can try again
      resetSelection();
    }
  };

  const onStopRecording = async () => {
    try {
      if (!controllerRef.current) return;
      setStatus("Finalizing recording…");
      setWorking(true);
      const blob = await controllerRef.current.stop();
      setRecording(false);
      lastBlobRef.current = blob;
      
      if (blob.size > 100 * 1024 * 1024) {
        setStatus("Recording too large (>100MB). Try recording a shorter session.");
        setWorking(false);
        return;
      }
      
      // Capture console logs and network requests before upload
      const logs = (window as any).__consoleCapture?.getLogs?.() || [];
      consoleLogsRef.current = logs;
      (window as any).__consoleCapture?.stop?.();
      
      const allNetworkRequests = stopNetworkMonitoring();
      networkRequestsRef.current = allNetworkRequests;
      
      // Open modal immediately (but don't upload yet)
      setStatus("Recording completed! Choose your action.");
      setUserSubmitted(false);
      setDescModalOpen(true);
      setUploadProgress(0);
      setPreUploadedVideoUrl(null);
    } catch (e: any) {
      console.error(e);
      setRecording(false);
      setStatus(`Recording failed: ${e.message || e}`);
    }
    setWorking(false);
  };

  const onUploadToZerops = async () => {
    if (!lastBlobRef.current) {
      setStatus("No recording available to upload");
      return;
    }

    setStatus("Uploading video to Zerops Object Storage...");
    setUploadProgress(10);
    
    console.log("📦 Starting Zerops upload process...");
    
    try {
      const videoUrl = await uploadVideoToZerops(lastBlobRef.current);
      console.log("✅ Zerops upload completed successfully:", videoUrl);
      setPreUploadedVideoUrl(videoUrl);
      setStatus("Video ready! Fill out the form to create GitHub issue.");
      setUploadProgress(0);
    } catch (error: any) {
      console.error("❌ Video upload failed:", error);
      setStatus(`Upload failed: ${error.message}`);
      setPreUploadedVideoUrl(null);
      setUploadProgress(0);
    }
  };

  const onCancelRecording = async () => {
    // If currently recording, stop it first
    if (recording && controllerRef.current) {
      try {
        await controllerRef.current.stop();
        setRecording(false);
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }

    // If there's an uploaded video, we don't need to delete it from Zerops
    // as it's stored in our own bucket and managed by us
    if (preUploadedVideoUrl) {
      console.log("🗑️ Video stored in Zerops Object Storage, no cleanup needed");
    }

    // Reset everything
    setDescModalOpen(false);
    setPreUploadedVideoUrl(null);
    setUploadProgress(0);
    setDesc("");
    setTitle("");
    setValidationError("");
    setElapsed(0);
    lastBlobRef.current = null;
    setStatus("Recording cancelled");
    resetSelection();
  };

  const uploadVideoToZerops = async (blob: Blob): Promise<string> => {
    setUploadProgress(15);
    
            console.log("📦 Uploading to Zerops Object Storage:", {
          blobSize: blob.size,
          blobType: blob.type,
          baseUrl: createClientFullUrl('/')
        });
    
    try {
      // Step 1: Get presigned upload URL from our API
      setUploadProgress(20);
      const filename = `recording-${Date.now()}.webm`;
      const uploadRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          filename, 
          contentType: blob.type 
        }),
      });
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error("❌ Zerops upload URL creation failed:", {
          status: uploadRes.status,
          statusText: uploadRes.statusText,
          errorText: errorText
        });
        throw new Error(`Failed to create upload URL: ${uploadRes.status} - ${errorText}`);
      }
      
      const { url, key } = await uploadRes.json();
      console.log("📤 Got Zerops upload URL:", { key, url: url.substring(0, 50) + "..." });
      
      // Step 2: Upload video directly to Zerops
      setUploadProgress(40);
      const putRes = await fetch(url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      
      if (!putRes.ok) {
        throw new Error(`Zerops upload failed: ${putRes.status}`);
      }
      
      console.log("✅ Video uploaded to Zerops successfully");
      
      // Step 3: Generate local video URL with key
      setUploadProgress(90);
      const timestamp = Date.now();
      const videoId = `zerops-${btoa(key).replace(/[/+=]/g, '')}-${timestamp}`;
                const localVideoUrl = createClientFullUrl(`/video/${videoId}`);
      
      console.log("✅ Video ready:", {
        key,
        videoId,
        localUrl: localVideoUrl
      });
      
      setUploadProgress(100);
      
      // Show the URL to the user immediately
      setStatus(`Video ready! Preview: ${localVideoUrl}`);
      
      return localVideoUrl;
      
    } catch (error: any) {
      console.error("❌ Zerops upload failed:", error);
      throw error;
    }
  };

  const uploadRecording = async (blob: Blob) => {
    let publicUrl: string | null = null;
    let inlineVideo: { base64: string; contentType: string } | null = null;
    
    // Remove old storage logic - now always use Mux
    if (false) { // Keep structure but never use inline
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
    
    const allNetworkRequests = stopNetworkMonitoring();
    networkRequestsRef.current = allNetworkRequests;
    
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
        networkRequests: networkRequestsRef.current,
        notes: desc,
        inlineVideo,
      }),
    });
    if (!issueRes.ok) {
      throw new Error(`issue failed: ${issueRes.status}`);
    }
    const res = await issueRes.json();
    setStatus(`Done → ${res.issueUrl}`);
  };

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const downloadLastRecording = () => {
    if (lastBlobRef.current) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      downloadBlob(`recording-${timestamp}.webm`, lastBlobRef.current);
    }
  };

  const resetSelection = () => {
    try {
      // Remove any recorder overlays from DOM (but preserve the floating widget)
      document.querySelectorAll('[data-recorder-overlay="1"]:not([data-recorder-widget])').forEach((el) => {
        try { (el as HTMLElement).remove(); } catch {}
      });
    } catch {}
    setSelecting(false);
    setSelectedTarget(null);
    setSelectedSel(null);
    setStatus("");
  };

  const resetGitHubState = () => {
    setGithubIssueUrl(null);
    setUploadStatus("idle");
    setUploadMessage("");
    setDesc("");
    setTitle("");
    setPreUploadedVideoUrl(null);
    setValidationError("");
  };

  const pickAreaFlow = async () => {
    if (selecting || selectedTarget || recording || working) return;
    setSelecting(true);
    
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
  };

  const fullScreenFlow = () => {
    if (selecting || selectedTarget || recording || working) return;
    const rect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    setSelectedTarget({ kind: "region", rect, label: "(full screen)" });
    setSelectedSel("(full screen)");
    setStatus("");
  };

  const createGitHubIssue = async () => {
    // Validation
    setValidationError("");
    
    if (!title.trim()) {
      setValidationError("Please provide a title for the issue.");
      return;
    }
    
    if (title.trim().length < 3) {
      setValidationError("Title should be at least 3 characters long.");
      return;
    }
    
    if (!desc.trim()) {
      setValidationError("Please provide a description of what happened.");
      return;
    }
    
    if (desc.trim().length < 10) {
      setValidationError("Description should be at least 10 characters long.");
      return;
    }
    
    if (!preUploadedVideoUrl) {
      setValidationError("Video is still uploading to Zerops. Please wait for upload to complete.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage("Creating GitHub issue...");
    
    try {
      const selectorLabel = "(region)";
      const diag = collectRegionDiagnostics({
        left: Math.floor(selectedTarget!.rect.left),
        top: Math.floor(selectedTarget!.rect.top),
        width: Math.floor(selectedTarget!.rect.width),
        height: Math.floor(selectedTarget!.rect.height),
      });

      // First, store detailed bug information
      const bugInfoPayload = {
        title: title.trim(),
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        targetRegion: diag.region,
        capturedElements: diag.elements,
        env: diag.env,
        consoleLogs: consoleLogsRef.current || [],
        networkRequests: networkRequestsRef.current,
        notes: desc,
        videoUrl: preUploadedVideoUrl,
      };

      console.log("📋 Storing detailed bug information to database...");
      
      const storeRes = await fetch("/api/store-bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bugInfoPayload),
      });

      if (!storeRes.ok) {
        throw new Error(`Failed to store bug info: ${storeRes.status}`);
      }

      const { infoId, infoUrl, summary } = await storeRes.json();
      
      console.log("✅ Bug info stored:", { infoId, infoUrl, summary });

      // Now create concise GitHub issue
      const requestPayload = {
        title: title.trim(),
        videoUrl: preUploadedVideoUrl,
        infoUrl: infoUrl,
        summary: summary,
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        notes: desc,
      };
      
      console.log("🔗 Creating concise GitHub issue with info URL:", infoUrl);

      const issueRes = await fetch("/api/create-issue-concise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      
      if (!issueRes.ok) {
        const errorText = await issueRes.text();
        console.error("❌ Create issue API error:", {
          status: issueRes.status,
          statusText: issueRes.statusText,
          errorText,
        });
        throw new Error(`Failed to create issue: ${issueRes.status} - ${errorText}`);
      }
      
      const res = await issueRes.json();
      console.log("✅ GitHub issue created successfully:", {
        number: res.number,
        url: res.issueUrl,
      });
      
      // Link the bug report to the GitHub issue
      try {
        console.log("🔗 Linking bug report to GitHub issue...");
        const linkRes = await fetch("/api/update-bug-github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bugReportId: infoId,
            githubIssueUrl: res.issueUrl,
            githubIssueNumber: res.number,
          }),
        });
        
        if (linkRes.ok) {
          console.log("✅ Bug report linked to GitHub issue successfully");
        } else {
          console.warn("⚠️ Failed to link bug report to GitHub issue (non-critical)");
        }
      } catch (linkError) {
        console.warn("⚠️ Failed to link bug report to GitHub issue:", linkError);
        // Don't fail the overall process if linking fails
      }
      
      setUploadStatus("success");
      setUploadMessage(`Issue created successfully! #${res.number}`);
      setStatus(`Done → ${res.issueUrl}`);
      setGithubIssueUrl(res.issueUrl);
      
      // Don't auto-close modal anymore - let user preview issue first
      // The modal will close manually when user clicks cancel or preview
    } catch (error: any) {
      console.error("❌ GitHub issue creation failed:", error);
      setUploadStatus("error");
      setUploadMessage(`Failed to create issue: ${error.message}`);
    }
  };

  const testApiWithDialog = async () => {
    try {
      setStatus("Testing API...");
      
      const testData = {
        title: testApiTitle,
        text: testApiText,
        hasVideo: testApiVideo !== null,
        videoName: testApiVideo?.name || null,
        videoSize: testApiVideo?.size || null,
      };

      const res = await fetch("/api/test-create-issue", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus(`API Test Success! Issue #${data.issueNumber} created`);
        setTestApiText("");
        setTestApiVideo(null);
        setTestApiModalOpen(false);
      } else {
        setStatus(`API Test Failed: ${data.error}`);
      }
    } catch (error: any) {
      setStatus(`API Test Error: ${error.message}`);
    }
  };

  useEffect(() => {
    const handleUnload = () => {
      try {
        if (controllerRef.current) {
          controllerRef.current.stop().catch(() => {});
        }
      } catch {}
      // Full reset (but preserve the floating widget)
      try {
        document.querySelectorAll('[data-recorder-overlay="1"]:not([data-recorder-widget])').forEach((el) => {
          try { (el as HTMLElement).remove(); } catch {}
        });
      } catch {}
    };
    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, []);

  const contextValue: RecorderContextType = {
    // State
    status,
    selectedSel,
    selectedTarget,
    recording,
    elapsed,
    working,
    selecting,
    descModalOpen,
    desc,
    title,
    userSubmitted,
    uploadStatus,
    uploadMessage,
    testApiModalOpen,
    testApiTitle,
    testApiText,
    testApiVideo,
    preUploadedVideoUrl,
    validationError,
    uploadProgress,
    githubIssueUrl,
    
    // Refs
    overlayRef,
    overlayCleanupRef,
    controllerRef,
    lastBlobRef,
    cursorRef,
    lastClickAtRef,
    networkRequestsRef,
    consoleLogsRef,
    
    // Actions
    setStatus,
    setSelectedSel,
    setSelectedTarget,
    setRecording,
    setElapsed,
    setWorking,
    setSelecting,
    setDescModalOpen,
    setDesc,
    setTitle,
    setUserSubmitted,
    setUploadStatus,
    setUploadMessage,
    setTestApiModalOpen,
    setTestApiTitle,
    setTestApiText,
    setTestApiVideo,
    setPreUploadedVideoUrl,
    setValidationError,
    setUploadProgress,
    setGithubIssueUrl,
    onStartRecording,
    onStopRecording,
    onUploadToZerops,
    onCancelRecording,
    resetSelection,
    resetGitHubState,
    pickAreaFlow,
    fullScreenFlow,
    testApiWithDialog,
    downloadLastRecording,
    createGitHubIssue,
  };

  return (
    <RecorderContext.Provider value={contextValue}>
      {children}
    </RecorderContext.Provider>
  );
};
