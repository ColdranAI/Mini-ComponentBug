"use client";

import { RecorderContextType } from "../contexts/RecorderContext";

export default class RecorderOverlay {
  private recorder: RecorderContextType;
  private overlayElement: HTMLDivElement | null = null;
  private controlsElement: HTMLDivElement | null = null;

  constructor(recorder: RecorderContextType) {
    this.recorder = recorder;
  }

  create() {
    if (!this.recorder.selectedTarget || this.recorder.recording) return;

    // Create main overlay
    this.overlayElement = document.createElement("div");
    this.overlayElement.setAttribute("data-recorder-overlay", "1");
    this.overlayElement.className = "fixed z-[2147483646] pointer-events-none border-2 border-neutral-500 bg-neutral-200/20";
    document.body.appendChild(this.overlayElement);

    // Create controls
    this.createControls();

    // Position elements
    this.updatePosition();

    // Add event listeners
    window.addEventListener("scroll", this.updatePosition);
    window.addEventListener("resize", this.updatePosition);
  }

  private createControls() {
    if (this.recorder.recording || this.controlsElement) return;

    this.controlsElement = document.createElement("div");
    this.controlsElement.setAttribute("data-recorder-overlay", "1");
    this.controlsElement.className = "fixed z-[2147483647] pointer-events-auto flex flex-col items-center gap-1 bg-white/90 backdrop-blur-sm border border-neutral-300 p-2 rounded";
    
    // Microphone option
    const micContainer = document.createElement("div");
    micContainer.className = "flex items-center gap-2 text-xs mb-2";
    const micCheckbox = document.createElement("input");
    micCheckbox.type = "checkbox";
    micCheckbox.id = "mic-option-overlay";
    micCheckbox.checked = this.recorder.enableMicrophone;
    micCheckbox.onchange = () => this.recorder.setEnableMicrophone(micCheckbox.checked);
    const micLabel = document.createElement("label");
    micLabel.htmlFor = "mic-option-overlay";
    micLabel.textContent = "🎤 Include microphone";
    micLabel.className = "text-neutral-700 cursor-pointer";
    micContainer.appendChild(micCheckbox);
    micContainer.appendChild(micLabel);
    
    // Button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "flex items-center gap-1";
    
    const startBtn = document.createElement("button");
    startBtn.textContent = "Start recording";
    startBtn.onclick = () => this.recorder.onStartRecording();
    startBtn.className = "px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700";
    
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Cancel selection");
    closeBtn.onclick = () => this.recorder.resetSelection();
    closeBtn.className = "px-2 py-1 text-xs bg-neutral-300 text-neutral-800 border border-neutral-400";
    
    buttonContainer.appendChild(startBtn);
    buttonContainer.appendChild(closeBtn);
    this.controlsElement.appendChild(micContainer);
    this.controlsElement.appendChild(buttonContainer);
    document.body.appendChild(this.controlsElement);
  }

  private updatePosition = () => {
    if (!this.recorder.selectedTarget || !this.overlayElement) return;

    const rect = this.recorder.selectedTarget.label === "(full screen)"
      ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
      : this.recorder.selectedTarget.rect;

    // Update overlay position
    Object.assign(this.overlayElement.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    // Update controls position
    if (this.controlsElement && !this.recorder.recording) {
      const controlsRect = this.controlsElement.getBoundingClientRect();
      const left = Math.max(8, Math.floor(rect.left + rect.width - controlsRect.width - 8));
      const top = Math.max(8, Math.floor(rect.top + rect.height - controlsRect.height - 8));
      Object.assign(this.controlsElement.style, { left: `${left}px`, top: `${top}px` });
    }
  };

  cleanup() {
    window.removeEventListener("scroll", this.updatePosition);
    window.removeEventListener("resize", this.updatePosition);
    this.controlsElement?.remove();
    this.overlayElement?.remove();
    this.overlayElement = null;
    this.controlsElement = null;
  }
}
