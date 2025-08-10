import { RecorderContextType } from "../contexts/RecorderContext";

export class RecorderOverlay {
  private recorder: RecorderContextType;
  private overlayElement: HTMLDivElement | null = null;
  private controlsElement: HTMLDivElement | null = null;

  constructor(recorder: RecorderContextType) {
    this.recorder = recorder;
  }

  create() {
    this.cleanup();

    const region = this.recorder.selectedTarget?.rect;
    if (!region) return;

    // Create overlay element
    this.overlayElement = document.createElement("div");
    this.overlayElement.style.cssText = `
      position: fixed;
      left: ${region.left}px;
      top: ${region.top}px;
      width: ${region.width}px;
      height: ${region.height}px;
      border: 2px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      pointer-events: none;
      z-index: 2147483646;
    `;
    this.overlayElement.setAttribute("data-recorder-overlay", "1");
    document.body.appendChild(this.overlayElement);

    this.createControls();
  }

  createControls() {
    this.cleanup();
    
    if (!this.overlayElement) return;
    
    // Create controls container
    const controlsContainer = document.createElement("div");
    controlsContainer.className = "absolute bottom-3 right-3 bg-white border border-neutral-300 rounded p-2 shadow-lg text-xs";
    controlsContainer.style.cssText = "z-index: 2147483647; pointer-events: auto; max-width: 200px;";
    
    if (!this.recorder.recording) {
      // Start recording button
      const startButton = document.createElement("button");
      startButton.textContent = "Start Recording";
      startButton.className = "block w-full px-3 py-2 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 mb-2";
      startButton.onclick = () => {
        this.recorder.onStartRecording();
      };
      controlsContainer.appendChild(startButton);
      
      // Cancel button
      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";
      cancelButton.className = "block w-full px-3 py-2 bg-neutral-200 text-neutral-700 rounded text-xs hover:bg-neutral-300";
      cancelButton.onclick = () => {
        this.recorder.resetSelection();
      };
      controlsContainer.appendChild(cancelButton);
    } else {
      // Recording status
      const statusDiv = document.createElement("div");
      statusDiv.className = "flex items-center gap-2 mb-2";
      statusDiv.innerHTML = `
        <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        <span class="text-red-600 font-medium">Recording ${this.recorder.elapsed}s</span>
      `;
      controlsContainer.appendChild(statusDiv);
      
      // Stop button
      const stopButton = document.createElement("button");
      stopButton.textContent = "Stop & Upload";
      stopButton.className = "block w-full px-3 py-2 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700";
      stopButton.onclick = () => {
        this.recorder.onStopAndUpload();
      };
      controlsContainer.appendChild(stopButton);
    }

    this.controlsElement = controlsContainer;
    this.overlayElement.appendChild(controlsContainer);
  }

  updatePosition() {
    const region = this.recorder.selectedTarget?.rect;
    if (!region || !this.overlayElement) return;

    // Update overlay position
    Object.assign(this.overlayElement.style, {
      left: `${region.left}px`,
      top: `${region.top}px`,
      width: `${region.width}px`,
      height: `${region.height}px`,
    });

    // Update controls - always show them
    this.createControls();
  }

  cleanup() {
    if (this.controlsElement) {
      this.controlsElement.remove();
      this.controlsElement = null;
    }
  }

  remove() {
    this.cleanup();
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }
}