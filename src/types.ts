export type ImageRemovalMethod = 'inpaint' | 'gemini-ai-inpaint' | 'blur' | 'pixelate' | 'color' | 'stretch';

export interface ImageEditorState {
  brushSize: number;
  removalMethod: ImageRemovalMethod;
  fillColor: string;
  blurRadius: number;
  pixelSize: number;
  stretchDirection: 'left' | 'right' | 'up' | 'down';
}

export type VideoRemovalMethod = 'blur' | 'pixelate' | 'color' | 'overlay' | 'inpaint' | 'gemini-ai-inpaint';

export interface VideoMaskZone {
  id: string;
  x: number; // percentage of video width (0-100)
  y: number; // percentage of video height (0-100)
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  method: VideoRemovalMethod;
  blurIntensity: number; // e.g. 5-50
  pixelSize: number; // e.g. 4-40
  fillColor: string;
  overlayText: string;
  overlayTextSize: number;
  overlayTextColor: string;
  featherSize?: number; // feather size in px (e.g., 0-30, defaults to 8)
  noiseIntensity?: number; // texture grain (e.g., 0-100, defaults to 5)
  geminiPatchBase64?: string; // Cache base64 of generated AI patch
}

export interface VideoEditorState {
  zones: VideoMaskZone[];
  selectedZoneId: string | null;
  playbackSpeed: number;
  cropEnable: boolean;
  cropX: number; // 0-100
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}
