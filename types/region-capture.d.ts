// Minimal DOM augmentation for Region Capture (Chromium)
// Allows using CropTarget and MediaStreamTrack.cropTo without TS errors.

interface CropTarget {}

interface Window {
  CropTarget?: {
    fromElement: (element: Element) => Promise<CropTarget>;
  };
}

interface MediaStreamTrack {
  cropTo?: (target: CropTarget) => Promise<void>;
}


