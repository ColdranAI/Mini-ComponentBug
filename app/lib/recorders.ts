import html2canvas from "html2canvas";
import type { ConsoleLogEntry } from "@/app/lib/telemetry";

export type Pointer = { x: number; y: number };

function getPageBackgroundColor(): string {
  try {
    const root = document.documentElement;
    const body = document.body;
    const rootStyles = getComputedStyle(root);
    const fromVar = rootStyles.getPropertyValue("--background").trim();
    if (fromVar) return fromVar;
    const bodyBg = getComputedStyle(body).backgroundColor;
    if (bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" && bodyBg !== "transparent") return bodyBg;
  } catch {}
  return "#ffffff";
}

function markFormElementsAndSnapshotValues() {
  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    )
  );
  const values = new Map<string, any>();
  const tagged: Element[] = [];
  const keyPrefix = `h2c-${Date.now()}-${Math.floor(Math.random() * 1e6)}-`;
  let i = 0;
  for (const el of elements) {
    const key = (el as any).dataset?.h2cKey || `${keyPrefix}${i++}`;
    (el as any).dataset.h2cKey = key;
    tagged.push(el);
    if (el instanceof HTMLInputElement) {
      values.set(key, {
        kind: "input",
        type: el.type,
        value: el.value,
        checked: el.checked,
      });
    } else if (el instanceof HTMLTextAreaElement) {
      values.set(key, {
        kind: "textarea",
        value: el.value,
      });
    } else if (el instanceof HTMLSelectElement) {
      values.set(key, {
        kind: "select",
        values: Array.from(el.selectedOptions).map((o) => o.value),
      });
    }
  }
  const cleanup = () => {
    for (const el of tagged) {
      try {
        delete (el as any).dataset.h2cKey;
      } catch {}
    }
  };
  return { values, cleanup };
}

function applyFormSnapshotsToClone(doc: Document, values: Map<string, any>) {
  const clones = Array.from(doc.querySelectorAll<HTMLElement>("[data-h2c-key]"));
  for (const node of clones) {
    const key = (node as any).dataset?.h2cKey;
    if (!key) continue;
    const v = values.get(key);
    if (!v) continue;
    if (v.kind === "input") {
      const inp = node as HTMLInputElement;
      if (v.type === "checkbox" || v.type === "radio") {
        inp.checked = !!v.checked;
      } else {
        inp.value = v.value ?? "";
        inp.setAttribute("value", inp.value);
      }
    } else if (v.kind === "textarea") {
      const ta = node as HTMLTextAreaElement;
      ta.value = v.value ?? "";
      ta.textContent = ta.value;
    } else if (v.kind === "select") {
      const sel = node as HTMLSelectElement;
      const valuesArr: string[] = Array.isArray(v.values) ? v.values : [];
      for (const opt of Array.from(sel.options)) {
        opt.selected = valuesArr.includes(opt.value);
      }
    }
  }
}

function getSelectionRects(): DOMRect[] {
  const rects: DOMRect[] = [];
  try {
    const sel = window.getSelection();
    if (!sel) return rects;
    if (sel.rangeCount > 0) {
      for (let i = 0; i < sel.rangeCount; i++) {
        const range = sel.getRangeAt(i);
        if (range.collapsed) continue;
        const cr = range.getClientRects();
        for (const r of Array.from(cr)) {
          if (r.width <= 0 || r.height <= 0) continue;
          rects.push(new DOMRect(r.left, r.top, r.width, r.height));
        }
      }
    }
    // Inputs/textarea approximation: if focused and has selection
    const ae = document.activeElement as any;
    if (ae && (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement)) {
      if (typeof ae.selectionStart === "number" && typeof ae.selectionEnd === "number" && ae.selectionStart !== ae.selectionEnd) {
        const r = ae.getBoundingClientRect();
        rects.push(new DOMRect(r.left + 2, r.top + 2, Math.max(1, r.width - 4), Math.max(1, r.height - 4)));
      }
    }
  } catch {}
  return rects;
}

function getCaretRect(): DOMRect | null {
  try {
    const sel = window.getSelection();
    if (!sel || !sel.focusNode) return null;
    if (sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const cr = range.getClientRects();
    if (cr && cr.length > 0) {
      const r = cr[0];
      return new DOMRect(r.left, r.top, Math.max(1, r.width || 1), Math.max(10, r.height || 14));
    }
  } catch {}
  return null;
}

function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  originLeft: number,
  originTop: number,
  canvasWidth: number,
  canvasHeight: number
) {
  try {
    // Text selection highlight
    const rects = getSelectionRects();
    ctx.save();
    ctx.fillStyle = "rgba(59,130,246,0.35)"; // blue-500 at ~35%
    for (const r of rects) {
      const x = Math.round(r.left - originLeft);
      const y = Math.round(r.top - originTop);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (x + w < 0 || y + h < 0 || x > canvasWidth || y > canvasHeight) continue;
      const cx = Math.max(0, x);
      const cy = Math.max(0, y);
      const cw = Math.min(canvasWidth - cx, w - (cx - x));
      const ch = Math.min(canvasHeight - cy, h - (cy - y));
      if (cw > 0 && ch > 0) ctx.fillRect(cx, cy, cw, ch);
    }
    // Caret (collapsed selection)
    const caret = getCaretRect();
    if (caret) {
      const x = Math.round(caret.left - originLeft);
      const y = Math.round(caret.top - originTop);
      if (x >= 0 && y >= 0 && x <= canvasWidth) {
        ctx.fillStyle = "rgba(17,24,39,0.9)"; // near-black
        const lineH = Math.min(canvasHeight - y, Math.max(12, caret.height));
        ctx.fillRect(x, y, 2, lineH);
      }
    }
    ctx.restore();
  } catch {}
}

async function snapshotCroppedArea(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  options: {
    backgroundColor: string;
    ignoreElements?: (node: Element) => boolean;
  }
) {
  const baseOpts: any = {
    backgroundColor: options.backgroundColor,
    scale: 1,
    useCORS: true,
    ignoreElements: options.ignoreElements,
    x: sx,
    y: sy,
    width: sw,
    height: sh,
    scrollX: 0,
    scrollY: 0,
  };

  const tryRender = async (foreignObjectRendering: boolean) => {
    return await html2canvas(document.documentElement, {
      ...baseOpts,
      foreignObjectRendering,
    } as any);
  };

  const isCanvasMostlyTransparent = (canvas: HTMLCanvasElement) => {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      if (!ctx) return false;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return true;
      // Sample a grid of pixels
      const samples = 10;
      let transparent = 0;
      let total = 0;
      for (let yi = 0; yi < samples; yi++) {
        for (let xi = 0; xi < samples; xi++) {
          const x = Math.floor((xi + 0.5) * (w / samples));
          const y = Math.floor((yi + 0.5) * (h / samples));
          const data = ctx.getImageData(x, y, 1, 1).data;
          if (data[3] === 0) transparent++;
          total++;
        }
      }
      return transparent / total > 0.9; // mostly empty
    } catch {
      return false;
    }
  };

  // First try with foreignObjectRendering (generally higher fidelity)
  let snap = await tryRender(true);
  if (isCanvasMostlyTransparent(snap)) {
    // Fallback to canvas renderer
    try {
      snap = await tryRender(false);
    } catch {}
  }
  return snap;
}

export function drawPointer(ctx: CanvasRenderingContext2D, x: number, y: number, lastClickAt: number | null) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const now = Date.now();
  const age = lastClickAt ? now - lastClickAt : null;
  ctx.save();
  ctx.fillStyle = "rgba(29,78,216,0.95)";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  if (age !== null && age < 400) {
    const r = 12 + (400 - age) * 0.03;
    ctx.strokeStyle = "rgba(29,78,216,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function canUseRegionCapture(): boolean {
  return typeof (window as any).CropTarget !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

export function createElementRegionCaptureController(
  el: HTMLElement,
  opts?: { fps?: number; maxSeconds?: number; maxBytes?: number }
) {
  const fps = opts?.fps ?? 8;
  const maxSeconds = Math.min(opts?.maxSeconds ?? 40, 40);
  const maxBytes = opts?.maxBytes ?? Math.floor(9.5 * 1024 * 1024);
  const bitrate = Math.floor(((maxBytes * 8) / maxSeconds) * 0.9);

  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let bytes = 0;
  let endTimer: any;

  return {
    async start() {
      const cropTarget = await (window as any).CropTarget.fromElement(el);
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: fps,
          displaySurface: "browser" as any,
          selfBrowserSurface: "include" as any,
          preferCurrentTab: true as any,
          cursor: "always",
        } as any,
        audio: false,
      });
      const [track] = stream.getVideoTracks();
      const anyTrack = track as any;
      if (typeof anyTrack.cropTo === "function") {
        await anyTrack.cropTo(cropTarget);
      } else if (typeof anyTrack.applyConstraints === "function") {
        try {
          await anyTrack.applyConstraints({ advanced: [{ cropTarget }] } as any);
        } catch {
          // ignore
        }
      }
      rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", bitsPerSecond: bitrate });
      chunks = [];
      bytes = 0;
      rec.ondataavailable = (e) => {
        if (!e.data.size) return;
        bytes += e.data.size;
        if (bytes >= maxBytes && rec!.state === "recording") rec!.stop();
        else chunks.push(e.data);
      };
      rec.start(500);
      endTimer = setTimeout(() => rec!.state === "recording" && rec!.stop(), maxSeconds * 1000);
    },
    async stop() {
      return new Promise<Blob>((resolve) => {
        if (!rec) {
          resolve(new Blob([], { type: "video/webm" }));
          return;
        }
        rec.onstop = () => {
          clearTimeout(endTimer);
          try {
            stream?.getTracks().forEach((t) => t.stop());
          } catch {}
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
        if (rec.state === "recording") rec.stop();
        else {
          clearTimeout(endTimer);
          try {
            stream?.getTracks().forEach((t) => t.stop());
          } catch {}
          resolve(new Blob(chunks, { type: "video/webm" }));
        }
      });
    },
  };
}

export async function recordRegionToBlob(region: DOMRect, opts?: { fps?: number; maxSeconds?: number; maxBytes?: number }) {
  const fps = opts?.fps ?? 8;
  const maxSeconds = opts?.maxSeconds ?? 30;
  const maxBytes = opts?.maxBytes ?? Math.floor(9.5 * 1024 * 1024);
  const bitrate = Math.floor(((maxBytes * 8) / maxSeconds) * 0.9);
  const pageBg = getPageBackgroundColor();

  const display = document.createElement("canvas");
  const ctx = display.getContext("2d")!;
  display.width = Math.max(1, Math.floor(region.width));
  display.height = Math.max(1, Math.floor(region.height));
  Object.assign(display.style, { position: "fixed", right: "8px", bottom: "8px", width: "160px", opacity: "0", pointerEvents: "none" } as CSSStyleDeclaration);
  document.body.appendChild(display);

  const stream = (display as HTMLCanvasElement).captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", bitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  let bytes = 0;
  rec.ondataavailable = (e) => {
    if (!e.data.size) return;
    bytes += e.data.size;
    if (bytes >= maxBytes && rec.state === "recording") rec.stop();
    else chunks.push(e.data);
  };

  const drawOnce = async () => {
    const { values, cleanup } = markFormElementsAndSnapshotValues();
    const sx = Math.floor(region.left + window.scrollX);
    const sy = Math.floor(region.top + window.scrollY);
    const sw = Math.floor(region.width);
    const sh = Math.floor(region.height);
    const snap = await snapshotCroppedArea(sx, sy, sw, sh, {
      backgroundColor: pageBg,
      ignoreElements: (node: Element) => node instanceof HTMLIFrameElement,
    });
    // Apply form snapshots to the cloned DOM via onclone is handled inside snapshotCroppedArea? No; do a best-effort by redrawing values afterward
    // Not possible post snapshot; rely on element/region controller below which includes onclone. This region helper is used only by recordRegionToBlob (not used currently by UI)
    ctx.clearRect(0, 0, display.width, display.height);
    ctx.drawImage(snap, 0, 0, display.width, display.height);
    drawSelectionOverlay(ctx, sx, sy, display.width, display.height);
    cleanup();
  };

  rec.start(1000 / fps);
  const interval = setInterval(async () => {
    try {
      await drawOnce();
    } catch {}
  }, 1000 / fps);

  const endTimer = setTimeout(() => rec.state === "recording" && rec.stop(), maxSeconds * 1000);
  await new Promise<void>((res) => (rec.onstop = () => res()));
  clearInterval(interval);
  clearTimeout(endTimer);
  stream.getTracks().forEach((t) => t.stop());
  display.remove();
  return new Blob(chunks, { type: "video/webm" });
}

export function createElementController(
  el: HTMLElement,
  opts?: { fps?: number; maxSeconds?: number; maxBytes?: number },
  cursorRef?: { current: Pointer },
  lastClickAtRef?: { current: number | null },
  overlayEl?: HTMLElement | null
) {
  const fps = opts?.fps ?? 8;
  const maxSeconds = opts?.maxSeconds ?? 30;
  const maxBytes = opts?.maxBytes ?? Math.floor(9.5 * 1024 * 1024);
  const bitrate = Math.floor(((maxBytes * 8) / maxSeconds) * 0.9);
  const mimeCandidates = [
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = (window as any).MediaRecorder?.isTypeSupported
    ? mimeCandidates.find((t) => (window as any).MediaRecorder.isTypeSupported(t)) || "video/webm"
    : "video/webm";

  let display: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let ro: ResizeObserver | null = null;
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let bytes = 0;
  let interval: any;
  let endTimer: any;

  const setup = () => {
    display = document.createElement("canvas");
    ctx = display.getContext("2d");
    Object.assign(display.style, {
      position: "fixed",
      right: "8px",
      bottom: "8px",
      width: "160px",
      opacity: "0",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    document.body.appendChild(display);
    const resize = () => {
      const r = el.getBoundingClientRect();
      display!.width = Math.max(2, Math.floor(r.width));
      display!.height = Math.max(2, Math.floor(r.height));
    };
    resize();
    ro = new ResizeObserver(resize);
    ro.observe(el);
    stream = display.captureStream(fps);
    rec = new MediaRecorder(stream, { mimeType, bitsPerSecond: bitrate });
    chunks = [];
    bytes = 0;
    rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      bytes += e.data.size;
      if (bytes >= maxBytes && rec!.state === "recording") rec!.stop();
      else chunks.push(e.data);
    };
    let drawing = false;
    const drawOnce = async () => {
      if (drawing) return;
      drawing = true;
      const pageBg = getPageBackgroundColor();
      const rect = el.getBoundingClientRect();
      const sx = Math.floor(rect.left + window.scrollX);
      const sy = Math.floor(rect.top + window.scrollY);
      const sw = Math.max(1, Math.floor(rect.width));
      const sh = Math.max(1, Math.floor(rect.height));
      const { values, cleanup } = markFormElementsAndSnapshotValues();
      const snap = await snapshotCroppedArea(sx, sy, sw, sh, {
        backgroundColor: pageBg,
        ignoreElements: (node: Element) => {
          if (node instanceof HTMLIFrameElement) return true;
          const elNode = node as Element;
          if (overlayEl && (elNode === overlayEl || overlayEl.contains(elNode))) return true;
          if (elNode && (elNode as Element).getAttribute && (elNode as Element).getAttribute!("data-recorder-overlay") === "1") return true;
          return false;
        },
      });
      ctx!.clearRect(0, 0, display!.width, display!.height);
      ctx!.drawImage(snap, 0, 0, display!.width, display!.height);
      drawSelectionOverlay(ctx!, sx, sy, display!.width, display!.height);
      if (cursorRef && lastClickAtRef) {
        const localX = cursorRef.current.x - rect.left;
        const localY = cursorRef.current.y - rect.top;
        if (localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height) {
          drawPointer(ctx!, localX, localY, lastClickAtRef.current);
        }
      }
      cleanup();
      drawing = false;
    };
    // prime a couple frames
    drawOnce();
    setTimeout(drawOnce, 60);
    rec.start(250);
    interval = setInterval(async () => {
      try {
        await drawOnce();
      } catch {}
    }, 1000 / fps);
    endTimer = setTimeout(() => rec!.state === "recording" && rec!.stop(), maxSeconds * 1000);
  };

  const teardown = () => {
    clearInterval(interval);
    clearTimeout(endTimer);
    ro?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    display?.remove();
  };

  return {
    start() {
      setup();
    },
    async stop() {
      return new Promise<Blob>((resolve) => {
        if (!rec) {
          resolve(new Blob([], { type: mimeType }));
          return;
        }
        rec.onstop = () => {
          teardown();
          resolve(new Blob(chunks, { type: mimeType }));
        };
        if (rec.state === "recording") rec.stop();
        else {
          teardown();
          resolve(new Blob(chunks, { type: mimeType }));
        }
      });
    },
  };
}

export function createRegionController(
  region: DOMRect,
  opts?: { fps?: number; maxSeconds?: number; maxBytes?: number },
  cursorRef?: { current: Pointer },
  lastClickAtRef?: { current: number | null },
  overlayEl?: HTMLElement | null
) {
  const fps = opts?.fps ?? 8;
  const maxSeconds = opts?.maxSeconds ?? 30;
  const maxBytes = opts?.maxBytes ?? Math.floor(9.5 * 1024 * 1024);

  const bitrate = Math.floor(((maxBytes * 8) / maxSeconds) * 0.9);
  const mimeCandidates = [
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = (window as any).MediaRecorder?.isTypeSupported
    ? mimeCandidates.find((t) => (window as any).MediaRecorder.isTypeSupported(t)) || "video/webm"
    : "video/webm";

  let display: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let bytes = 0;
  let interval: any;
  let endTimer: any;
  const subtitleEvents: Array<{ t: number; text: string }> = [];
  const startedAt = () => (performance?.now?.() || Date.now());
  let t0 = startedAt();

  const pushSubtitle = (text: string) => {
    const t = (startedAt() - t0) / 1000;
    subtitleEvents.push({ t, text });
  };

  const getAccessibleName = (el: Element): string => {
    try {
      const he = el as HTMLElement;
      const aria = he.getAttribute("aria-label");
      if (aria) return aria.trim();
      const labelled = he.getAttribute("aria-labelledby");
      if (labelled) {
        const ids = labelled.split(/\s+/g);
        const parts: string[] = [];
        for (const id of ids) {
          const n = document.getElementById(id);
          if (n) parts.push((n.textContent || "").trim());
        }
        const s = parts.filter(Boolean).join(" ").trim();
        if (s) return s;
      }
      const text = (he.innerText || he.textContent || "").trim().replace(/\s+/g, " ");
      if (text) return text;
      if (he instanceof HTMLInputElement && he.value) return he.value;
    } catch {}
    return "";
  };

  const describeClickable = (el: Element): string => {
    const he = el as HTMLElement;
    const name = getAccessibleName(he);
    const tag = he.tagName.toLowerCase();
    let kind = tag;
    if (he.getAttribute("role") === "button" || tag === "button") kind = "button";
    else if (tag === "a") kind = "link";
    else if (tag === "input") kind = "input";
    const label = name || he.id || he.getAttribute("name") || he.getAttribute("title") || "element";
    const short = label.length > 60 ? label.slice(0, 57) + "…" : label;
    return `${kind}: "${short}"`;
  };

  const setup = async () => {
    display = document.createElement("canvas");
    ctx = display.getContext("2d");
    
    // Use exact region dimensions for canvas size
    const canvasWidth = Math.max(2, Math.ceil(region.width));
    const canvasHeight = Math.max(2, Math.ceil(region.height));
    
    display.width = canvasWidth;
    display.height = canvasHeight;
    Object.assign(display.style, { 
      position: "fixed", 
      right: "8px", 
      bottom: "8px", 
      width: "160px", 
      opacity: "0", 
      pointerEvents: "none" 
    } as CSSStyleDeclaration);
    document.body.appendChild(display);
    stream = display.captureStream(fps);
    

    
    rec = new MediaRecorder(stream, { mimeType, bitsPerSecond: bitrate });
    chunks = [];
    bytes = 0;
    rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      bytes += e.data.size;
      if (bytes >= maxBytes && rec!.state === "recording") rec!.stop();
      else chunks.push(e.data);
    };
    const isFullscreenLike =
      region.left <= 1 &&
      region.top <= 1 &&
      Math.abs(region.width - window.innerWidth) <= 2 &&
      Math.abs(region.height - window.innerHeight) <= 2;

    let drawing = false;
    const drawOnce = async () => {
      if (drawing) return;
      drawing = true;
      
      // Use precise region coordinates - no dynamic adaptation
      const sx = Math.floor(region.left + window.scrollX);
      const sy = Math.floor(region.top + window.scrollY);
      const sw = Math.max(1, Math.ceil(region.width));
      const sh = Math.max(1, Math.ceil(region.height));
      
      // Ensure canvas matches exact region size
      if (display!.width !== sw || display!.height !== sh) {
        display!.width = sw;
        display!.height = sh;
      }
      const pageBg = getPageBackgroundColor();
      const { values, cleanup } = markFormElementsAndSnapshotValues();
      const snap = await snapshotCroppedArea(sx, sy, sw, sh, {
        backgroundColor: pageBg,
        ignoreElements: (node: Element) => {
          if (node instanceof HTMLIFrameElement) return true;
          const el = node as Element;
          if (overlayEl && (el === overlayEl || overlayEl.contains(el))) return true;
          if (el && (el as Element).getAttribute && (el as Element).getAttribute!("data-recorder-overlay") === "1") return true;
          return false;
        },

      });
      
      ctx!.clearRect(0, 0, display!.width, display!.height);
      // Draw the snapshot at exact 1:1 scale - no scaling/cropping
      ctx!.drawImage(snap, 0, 0);
      // No selection overlay during recording - it's distracting
      // drawSelectionOverlay(ctx!, sx, sy, display!.width, display!.height);
      // Render captions (last 2 seconds), left-to-right, max 80% width, near bottom with margin
      try {
        ctx!.save();
        const nowT = (startedAt() - t0) / 1000;
        const recent = subtitleEvents.filter((e) => nowT - e.t <= 2);
        if (recent.length) {
          const joinText = recent.map((e) => e.text).join(" • ");
          const padX = 10;
          const padY = 8;
          const maxBoxWidth = Math.floor(display!.width * 0.8);
          const leftX = Math.floor(display!.width * 0.1);
          ctx!.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
          ctx!.textBaseline = "alphabetic";
          ctx!.fillStyle = "#fff";
          // wrap words
          const words = joinText.split(/\s+/g);
          const lines: string[] = [];
          let current = "";
          for (const w of words) {
            const test = current ? current + " " + w : w;
            const wWidth = ctx!.measureText(test).width;
            if (wWidth + padX * 2 > maxBoxWidth && current) {
              lines.push(current);
              current = w;
            } else {
              current = test;
            }
          }
          if (current) lines.push(current);
          const lineHeight = 18;
          const boxHeight = lines.length * lineHeight + padY * 2;
          const boxY = display!.height - boxHeight - 18; // bottom margin
          // background box
          ctx!.fillStyle = "rgba(0,0,0,0.6)";
          ctx!.fillRect(leftX, boxY, maxBoxWidth, boxHeight);
          // text
          ctx!.fillStyle = "#fff";
          lines.forEach((l, i) => {
            ctx!.fillText(l, leftX + padX, boxY + padY + (i + 1) * lineHeight - 4);
          });
        }
        ctx!.restore();
      } catch {}
      if (cursorRef && lastClickAtRef) {
        const localX = cursorRef.current.x - region.left;
        const localY = cursorRef.current.y - region.top;
        if (localX >= 0 && localY >= 0 && localX <= display!.width && localY <= display!.height) {
          drawPointer(ctx!, localX, localY, lastClickAtRef.current);
        }
      }
      cleanup();
      drawing = false;
    };
    // prime frames before starting
    drawOnce();
    setTimeout(drawOnce, 60);
    // Capture user interactions for subtitles
    const onClick = (e: MouseEvent) => {
      try {
        let el = e.target as Element | null;
        if (!el) {
          pushSubtitle("Click");
          return;
        }
        // ignore clicks on overlays
        if ((el as HTMLElement).closest('[data-recorder-overlay="1"]')) return;
        // find nearest clickable ancestor
        const clickableSelector = 'button, a, [role="button"], input, [onclick]';
        const clickable = (el.matches && el.matches(clickableSelector)) ? el : el.closest?.(clickableSelector);
        if (clickable) {
          pushSubtitle(`Click: ${describeClickable(clickable)}`);
        } else {
          pushSubtitle("Click");
        }
      } catch {
        pushSubtitle("Click");
      }
    };
    const onKeydown = (e: KeyboardEvent) => pushSubtitle(`Key ${e.key}`);
    const onSelect = () => pushSubtitle("Selecting text");
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeydown, true);
    document.addEventListener("selectionchange", onSelect, true);
    // store for cleanup
    (display as any).__cleanupHandlers = { onClick, onKeydown, onSelect };
    rec.start(500);
    interval = setInterval(async () => {
      try {
        await drawOnce();
      } catch {}
    }, 1000 / fps);
    endTimer = setTimeout(() => rec!.state === "recording" && rec!.stop(), maxSeconds * 1000);
  };

  const teardown = () => {
    clearInterval(interval);
    clearTimeout(endTimer);
    stream?.getTracks().forEach((t) => t.stop());
    display?.remove();
    try {
      const h = (display as any).__cleanupHandlers;
      if (h) {
        window.removeEventListener("click", h.onClick, true);
        window.removeEventListener("keydown", h.onKeydown, true);
        document.removeEventListener("selectionchange", h.onSelect, true);
      }
    } catch {}
  };

  return {
    start() {
      setup();
    },
    async stop() {
      return new Promise<Blob>((resolve) => {
        if (!rec) {
          resolve(new Blob([], { type: mimeType }));
          return;
        }
        rec.onstop = () => {
          teardown();
          resolve(new Blob(chunks, { type: mimeType }));
        };
        if (rec.state === "recording") rec.stop();
        else {
          teardown();
          resolve(new Blob(chunks, { type: mimeType }));
        }
      });
    },
  };
}


