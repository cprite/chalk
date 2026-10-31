import { useRef } from "react";

type SketchPanelProps = {
  previewUrl: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  error: string | null;
  onSelectFile: (file: File) => void;
  onAnalyze: () => void;
  onCameraRequest: () => void;
};

export function SketchPanel({
  previewUrl,
  fileName,
  isAnalyzing,
  error,
  onSelectFile,
  onAnalyze,
  onCameraRequest,
}: SketchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
          if (file) onSelectFile(file);
        }}
      />

      <div className={`sketch-preview ${previewUrl ? "sketch-preview--filled" : ""}`}>
        {previewUrl ? (
          <img src={previewUrl} alt="Preview of your uploaded physics sketch" />
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

      <p className="upload-name" aria-live="polite">{fileName ?? "PNG or JPEG · up to 5 MB"}</p>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}

      <div className="stacked-actions">
        <button className="button button--secondary" type="button" onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">↥</span> Upload sketch
        </button>
        <button className="button button--ghost" type="button" onClick={onCameraRequest}>
          <span aria-hidden="true">◉</span> Use camera
        </button>
      </div>
      <button className="button button--primary full-width" type="button" disabled={!previewUrl || isAnalyzing} onClick={onAnalyze}>
        {isAnalyzing ? "Reading your sketch…" : "Analyze drawing"}
      </button>
    </section>
  );
}
