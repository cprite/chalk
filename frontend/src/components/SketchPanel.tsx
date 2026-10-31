import { useEffect, useRef, useState } from "react";

type SketchPanelProps = {
  previewUrl: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  analysisSuccess: string | null;
  error: string | null;
  previewError: string | null;
  sceneSource: "live" | "demo";
  onSelectFile: (file: File) => void;
  onPreviewError: (url: string) => void;
  onAnalyze: () => void;
  onRetry: () => void;
  onUseDemo: () => void;
  onSelectPreset?: (url: string, name: string) => void;
};

export function SketchPanel({
  previewUrl,
  fileName,
  isAnalyzing,
  analysisSuccess,
  error,
  previewError,
  sceneSource,
  onSelectFile,
  onPreviewError,
  onAnalyze,
  onRetry,
  onUseDemo,
  onSelectPreset,
}: SketchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCameraError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission denied. Upload a sketch file or choose a preset."
          : `Camera not available on this device: ${message}`,
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [cameraActive]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "camera_sketch.png", { type: "image/png" });
          onSelectFile(file);
        }
        stopCamera();
      },
      "image/png",
      0.95
    );
  };

  return (
    <section className="panel sketch-panel" aria-labelledby="sketch-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">01 / INPUT</p>
          <h2 id="sketch-title">Your sketch</h2>
        </div>
        <span className="step-dot">1</span>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelectFile(file);
            event.target.value = ""; // reset so same file can be re-selected
          }
        }}
      />

      <div className={`sketch-preview ${previewUrl || cameraActive ? "sketch-preview--filled" : ""}`}>
        {cameraActive ? (
          <div className="camera-viewfinder">
            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
            <div className="camera-overlay">
              <button type="button" className="button button--primary button--sm" onClick={capturePhoto}>📸 Snap photo</button>
              <button type="button" className="button button--ghost button--sm" onClick={stopCamera}>Cancel</button>
            </div>
          </div>
        ) : previewUrl ? (
          <img src={previewUrl} alt="Preview of your uploaded physics sketch" onError={() => onPreviewError(previewUrl)} />
        ) : previewError ? (
          <div className="empty-sketch" role="status">
            <span>{previewError}</span>
          </div>
        ) : (
          <div className="empty-sketch" aria-hidden="true">
            <svg viewBox="0 0 160 104" role="img">
              <path d="M20 82 140 82 140 23Z" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="52" cy="60" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M58 64 86 72" stroke="currentColor" strokeDasharray="5 4" strokeWidth="2" />
              <text x="108" y="18" fill="currentColor" fontSize="12">θ</text>
            </svg>
            <span>Draw or photograph a problem</span>
          </div>
        )}
      </div>

      <p className="upload-name" aria-live="polite">
        {isAnalyzing ? "Analyzing sketch…" : fileName ?? "PNG or JPEG · up to 5 MB"}
      </p>
      {analysisSuccess ? (
        <div className="sketch-success-badge" role="status">
          <span className="success-icon">✓</span>
          <span>{analysisSuccess}</span>
        </div>
      ) : null}
      {error ? (
        <div className="inline-error" role="alert">
          <p>{error}</p>
          <div className="stacked-actions">
            <button className="button button--secondary" type="button" disabled={isAnalyzing} onClick={onRetry}>Retry analysis</button>
            <button className="button button--ghost" type="button" disabled={isAnalyzing} onClick={onUseDemo}>Use demo scene</button>
          </div>
        </div>
      ) : null}
      <p className="scene-provenance" aria-live="polite">
        {sceneSource === "live" ? "Live Gemini analysis applied to this experiment." : "Demo scene active — this experiment was not generated from your uploaded sketch."}
      </p>
      {cameraError ? <p className="inline-error" role="alert">{cameraError}</p> : null}

      <div className="stacked-actions">
        <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">↥</span> Upload sketch
        </button>
        <button className="button button--ghost" type="button" onClick={startCamera}>
          <span aria-hidden="true">◉</span> Use camera
        </button>
      </div>

      <button
        className="button button--primary full-width"
        type="button"
        disabled={!previewUrl || isAnalyzing}
        onClick={onAnalyze}
      >
        {isAnalyzing ? "Reading your sketch…" : "Analyze drawing"}
      </button>

      {onSelectPreset && (
        <div className="sketch-presets-block">
          <p className="presets-heading">Quick demo sketches:</p>
          <div className="preset-pill-list">
            <button
              type="button"
              className="preset-pill-btn"
              onClick={() => onSelectPreset("/drawings/spring_series_5kg.png", "spring_series_5kg.png")}
            >
              🌀 2 Springs Series (k₁=200, k₂=300, 5 kg)
            </button>
            <button
              type="button"
              className="preset-pill-btn"
              onClick={() => onSelectPreset("/drawings/user_sketch_60deg_20kg.png", "user_sketch_60deg_20kg.png")}
            >
              📐 60° · 20 kg Block
            </button>
            <button
              type="button"
              className="preset-pill-btn"
              onClick={() => onSelectPreset("/drawings/incline_block_labelled.png", "incline_block_3kg.png")}
            >
              📐 30° · 3 kg Block
            </button>
            <button
              type="button"
              className="preset-pill-btn"
              onClick={() => onSelectPreset("/drawings/incline_ball_labelled.png", "incline_ball_1kg.png")}
            >
              ⚽ 30° · 1 kg Ball
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
