"use client";

import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { pickArea } from "@/app/lib/pickers";
import { createRegionController } from "@/app/lib/recorders";
import { collectRegionDiagnostics } from "@/app/lib/inspect";
import { startConsoleCapture } from "@/app/lib/telemetry";
import { startNetworkMonitoring, stopNetworkMonitoring, type NetworkRequest } from "@/app/lib/network-monitor";

export interface RecorderState {
  status: string;
  selectedSel: string | null;
  selectedTarget: { kind: "region"; rect: DOMRect; label: string } | null;
  recording: boolean;
  elapsed: number;
  working: boolean;
  selecting: boolean;
  enableMicrophone: boolean;
  descModalOpen: boolean;
  desc: string;
  userSubmitted: boolean;
  uploadStatus: "idle" | "uploading" | "success" | "error";
  uploadMessage: string;
  testApiModalOpen: boolean;
  testApiText: string;
  testApiVideo: File | null;
  preUploadedVideoUrl: string | null;
  validationError: string;
  uploadProgress: number;
}

export interface RecorderRefs {
  overlayRef: React.MutableRefObject<HTMLDivElement | null>;
  overlayCleanupRef: React.MutableRefObject<() => void>;
  controllerRef: React.MutableRefObject<null | { start: () => void; stop: () => Promise<Blob> }>;
  lastBlobRef: React.MutableRefObject<Blob | null>;
  cursorRef: React.MutableRefObject<{ x: number; y: number }>;
  lastClickAtRef: React.MutableRefObject<number | null>;
  networkRequestsRef: React.MutableRefObject<NetworkRequest[]>;
}

export interface RecorderActions {
  setStatus: (status: string) => void;
  setSelectedSel: (sel: string | null) => void;
  setSelectedTarget: (target: { kind: "region"; rect: DOMRect; label: string } | null) => void;
  setRecording: (recording: boolean) => void;
  setElapsed: (elapsed: number) => void;
  setWorking: (working: boolean) => void;
  setSelecting: (selecting: boolean) => void;
  setEnableMicrophone: (enable: boolean) => void;
  setDescModalOpen: (open: boolean) => void;
  setDesc: (desc: string) => void;
  setUserSubmitted: (submitted: boolean) => void;
  setUploadStatus: (status: "idle" | "uploading" | "success" | "error") => void;
  setUploadMessage: (message: string) => void;
  setTestApiModalOpen: (open: boolean) => void;
  setTestApiText: (text: string) => void;
  setTestApiVideo: (file: File | null) => void;
  setPreUploadedVideoUrl: (url: string | null) => void;
  setValidationError: (error: string) => void;
  setUploadProgress: (progress: number) => void;
  onStartRecording: () => Promise<void>;
  onStopAndUpload: () => Promise<void>;
  resetSelection: () => void;
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
  const [enableMicrophone, setEnableMicrophone] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [userSubmitted, setUserSubmitted] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [testApiModalOpen, setTestApiModalOpen] = useState(false);
  const [testApiText, setTestApiText] = useState("");
  const [testApiVideo, setTestApiVideo] = useState<File | null>(null);
  const [preUploadedVideoUrl, setPreUploadedVideoUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Refs
  const networkRequestsRef = useRef<NetworkRequest[]>([]);
  const controllerRef = useRef<null | { start: () => void; stop: () => Promise<Blob> }>(null);
  const lastBlobRef = useRef<Blob | null>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastClickAtRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const overlayCleanupRef = useRef<() => void>(() => {});

  console.log("🔧 Using Mux Video for uploads");

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
      const startedAt = savedState ? JSON.parse(savedState).startTime : Date.now();
      
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
      
      timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 200);
    } else {
      setElapsed(0);
      localStorage.removeItem('bug-reporter-recording');
    }
    return () => clearInterval(timer);
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
    setStatus("Recording…");
    setRecording(true);
    setUserSubmitted(false);
    
    (window as any).__consoleCapture = startConsoleCapture();
    startNetworkMonitoring();
    
    if (selectedTarget.kind === "region") {
      controllerRef.current = createRegionController(
        selectedTarget.rect,
        { fps: 8, maxSeconds: 30, enableMicrophone },
        cursorRef as any,
        lastClickAtRef as any,
        overlayRef.current
      );
    }
    await controllerRef.current?.start();
  };

  const onStopAndUpload = async () => {
    try {
      if (!controllerRef.current) return;
      setStatus("Finalizing recording…");
      setWorking(true);
      const blob = await controllerRef.current.stop();
      setRecording(false);
      lastBlobRef.current = blob;
      
      if (blob.size > 9.5 * 1024 * 1024) {
        setStatus("Recording too large (>9.5MB). Try recording a shorter session.");
        setWorking(false);
        return;
      }
      
      // Auto-upload the video immediately
      setStatus("Uploading video...");
      setUploadProgress(0);
      const logs = (window as any).__consoleCapture?.getLogs?.() || [];
      (window as any).__consoleCapture?.stop?.();
      
      const allNetworkRequests = stopNetworkMonitoring();
      networkRequestsRef.current = allNetworkRequests;
      
      try {
        const videoUrl = await uploadVideoToMux(blob);
        setPreUploadedVideoUrl(videoUrl);
        setStatus("Video uploaded to Mux! Add description to create GitHub issue.");
        setUploadProgress(0); // Reset for next upload
        
        // Open modal for description
        setUserSubmitted(false);
        setDescModalOpen(true);
      } catch (error: any) {
        console.error("❌ Video upload failed:", error);
        setStatus(`Upload failed: ${error.message}`);
        setPreUploadedVideoUrl(null);
        setUploadProgress(0);
        setDescModalOpen(true); // Still allow manual download
      }
    } catch (e: any) {
      console.error(e);
      setRecording(false);
      setStatus(`Recording failed: ${e.message || e}`);
    }
    setWorking(false);
  };

  const uploadVideoToMux = async (blob: Blob): Promise<string> => {
    setUploadProgress(10);
    
    console.log("📹 Uploading to Mux Video:", {
      blobSize: blob.size,
      blobType: blob.type
    });
    
    try {
      // Step 1: Create Mux direct upload URL
      setUploadProgress(20);
      const uploadRes = await fetch("/api/mux-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!uploadRes.ok) {
        throw new Error(`Failed to create Mux upload: ${uploadRes.status}`);
      }
      
      const { uploadId, uploadUrl } = await uploadRes.json();
      console.log("📤 Got Mux upload URL:", { uploadId, uploadUrl });
      
      // Step 2: Upload video to Mux
      setUploadProgress(40);
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": blob.type },
      });
      
      if (!putRes.ok) {
        throw new Error(`Mux upload failed: ${putRes.status}`);
      }
      
      console.log("✅ Video uploaded to Mux, processing...");
      
      // Step 3: Poll for processing completion
      setUploadProgress(60);
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (attempts < maxAttempts) {
        setUploadProgress(60 + (attempts / maxAttempts) * 30);
        
        const statusRes = await fetch(`/api/mux-status?uploadId=${uploadId}`);
        if (!statusRes.ok) {
          throw new Error(`Status check failed: ${statusRes.status}`);
        }
        
        const status = await statusRes.json();
        console.log("📊 Mux processing status:", status);
        
        if (status.ready && status.playbackId) {
          setUploadProgress(100);
          
          // Generate our local video URL
          const timestamp = Date.now();
          const videoId = `mux-${status.playbackId}-${timestamp}`;
          const localVideoUrl = `${window.location.origin}/video/${videoId}`;
          
          console.log("✅ Video ready:", {
            playbackId: status.playbackId,
            videoId,
            localUrl: localVideoUrl
          });
          
          return localVideoUrl;
        }
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      throw new Error("Video processing timed out. Please try again.");
      
    } catch (error: any) {
      console.error("❌ Mux upload failed:", error);
      throw error;
    }
  };

  const uploadRecording = async (blob: Blob) => {
    let publicUrl: string | null = null;
    let inlineVideo: { base64: string; contentType: string } | null = null;
    
    if (!useStorage || blob.size <= 1024 * 1024) {
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
    setSelectedTarget(null);
    setSelectedSel(null);
    setStatus("");
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
    
    if (!desc.trim()) {
      setValidationError("Please provide a description of what happened.");
      return;
    }
    
    if (desc.trim().length < 10) {
      setValidationError("Description should be at least 10 characters long.");
      return;
    }
    
    if (!preUploadedVideoUrl) {
      setValidationError("No video URL found. Please wait for upload to complete or record again.");
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

      // Prepare request payload - use our local video URL
      const requestPayload: any = {
        title: desc.trim().slice(0, 120),
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        targetRegion: diag.region,
        capturedElements: diag.elements,
        env: diag.env,
        consoleLogs: (window as any).__consoleCapture?.getLogs?.() || [],
        networkRequests: networkRequestsRef.current,
        notes: desc,
        videoUrl: preUploadedVideoUrl,
      };
      
      console.log("🔗 Creating GitHub issue with local video URL:", preUploadedVideoUrl);

      console.log("📤 Sending create-issue request:", {
        title: requestPayload.title,
        hasVideoUrl: !!requestPayload.videoUrl,
        videoUrl: requestPayload.videoUrl,
        networkRequestsCount: requestPayload.networkRequests?.length || 0,
        consoleLogsCount: requestPayload.consoleLogs?.length || 0,
      });

      const issueRes = await fetch("/api/create-issue", {
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
      
      setUploadStatus("success");
      setUploadMessage(`Issue created successfully! #${res.number}`);
      setStatus(`Done → ${res.issueUrl}`);
      
      setTimeout(() => {
        setDescModalOpen(false);
        setUploadStatus("idle");
        setUploadMessage("");
        setDesc("");
        setPreUploadedVideoUrl(null);
      }, 3000);
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

  const contextValue: RecorderContextType = {
    // State
    status,
    selectedSel,
    selectedTarget,
    recording,
    elapsed,
    working,
    selecting,
    enableMicrophone,
    descModalOpen,
    desc,
    userSubmitted,
    uploadStatus,
    uploadMessage,
    testApiModalOpen,
    testApiText,
    testApiVideo,
    preUploadedVideoUrl,
    validationError,
    uploadProgress,
    
    // Refs
    overlayRef,
    overlayCleanupRef,
    controllerRef,
    lastBlobRef,
    cursorRef,
    lastClickAtRef,
    networkRequestsRef,
    
    // Actions
    setStatus,
    setSelectedSel,
    setSelectedTarget,
    setRecording,
    setElapsed,
    setWorking,
    setSelecting,
    setEnableMicrophone,
    setDescModalOpen,
    setDesc,
    setUserSubmitted,
    setUploadStatus,
    setUploadMessage,
    setTestApiModalOpen,
    setTestApiText,
    setTestApiVideo,
    setPreUploadedVideoUrl,
    setValidationError,
    setUploadProgress,
    onStartRecording,
    onStopAndUpload,
    resetSelection,
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
