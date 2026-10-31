import { useEffect, useRef } from "react";
import { dismissPresentationOverlay, togglePresentationOverlay } from "../presentation";
import type { PresentationOverlay } from "../presentation";
import type { InclineSceneSpec, SceneSpec, SpringSceneSpec, VerificationVerdict, VoiceState } from "../types";
import { Controls } from "./Controls";
import { PhysicsScene } from "./PhysicsScene";
import { ResultsPanel } from "./ResultsPanel";

type VoiceMessage = {
  speaker: "You" | "Chalk";
  text: string;
};

type PresentationStageProps = {
  scene: SceneSpec;
  isPlaying: boolean;
  isVerifying: boolean;
  verdict: VerificationVerdict | null;
  voiceState: VoiceState;
  voiceError: string | null;
  transcript: string;
  assistantResponse: string;
  voiceHistory: VoiceMessage[];
  overlay: PresentationOverlay;
  onOverlayChange: (overlay: PresentationOverlay) => void;
  onChangeScene: (field: string, value: any) => void;
  onChangeBody: (body: "ball" | "block") => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onToggleVoice: () => void;
  onRetryVoice: () => void;
  onExit: () => void;
};

const voiceLabels: Record<VoiceState, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Chalk",
  error: "Voice unavailable",
};

export function PresentationStage({
  scene,
  isPlaying,
  isVerifying,
  verdict,
  voiceState,
  voiceError,
  transcript,
  assistantResponse,
  voiceHistory,
  overlay,
  onOverlayChange,
  onChangeScene,
  onChangeBody,
  onTogglePlay,
  onReset,
  onToggleVoice,
  onRetryVoice,
  onExit,
}: PresentationStageProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const resultsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (overlay) closeButtonRef.current?.focus();
  }, [overlay]);

  const toggleOverlay = (requested: Exclude<PresentationOverlay, null>) => {
    onOverlayChange(togglePresentationOverlay(overlay, requested));
  };

  const closeOverlay = () => {
    const trigger = overlay === "controls"
      ? controlsButtonRef.current
      : overlay === "history"
        ? historyButtonRef.current
        : resultsButtonRef.current;
    onOverlayChange(dismissPresentationOverlay());
    requestAnimationFrame(() => trigger?.focus());
  };

  const verificationLabel = verdict && verdict.source !== "backend"
    ? "Demo comparison"
    : verdict?.status === "match"
    ? "Verified"
    : verdict?.status === "mismatch"
      ? "Mismatch"
      : verdict?.status === "not_applicable"
        ? "Not applicable"
        : null;

  return (
    <section
      className="presentation-stage"
      id="top"
      aria-labelledby="presentation-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && overlay) {
          event.stopPropagation();
          closeOverlay();
        }
      }}
    >
      <header className="presentation-header">
        <div className="presentation-title">
          <a className="wordmark" href="#top" aria-label="Chalk home">chalk<span>.</span></a>
          <p id="presentation-title">Inclined plane</p>
          <span className="presentation-mode-badge"><i /> Mock mode</span>
          {verificationLabel ? <span className="presentation-verification" aria-live="polite">{verificationLabel}</span> : null}
        </div>
        <div className="presentation-tools" aria-label="Presentation tools">
          <button ref={controlsButtonRef} className="presentation-tool" type="button" onClick={() => toggleOverlay("controls")} aria-controls="presentation-overlay" aria-expanded={overlay === "controls"}>
            Controls
          </button>
          <button ref={historyButtonRef} className="presentation-tool" type="button" onClick={() => toggleOverlay("history")} aria-controls="presentation-overlay" aria-expanded={overlay === "history"}>
            History
          </button>
          <button ref={resultsButtonRef} className="presentation-tool" type="button" onClick={() => toggleOverlay("results")} aria-controls="presentation-overlay" aria-expanded={overlay === "results"}>
            Results
          </button>
          <button className="presentation-tool presentation-tool--exit" type="button" onClick={onExit}>
            Exit
          </button>
        </div>
      </header>

      <div className="presentation-scene">
        <PhysicsScene scene={scene} isPlaying={isPlaying} onChangeBody={onChangeBody} />
      </div>

      <footer className="presentation-footer">
        <div className="presentation-run-controls">
          <button className="presentation-tool presentation-tool--run" type="button" onClick={onTogglePlay}>
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span> {isPlaying ? "Pause" : "Play"}
          </button>
          <button className="presentation-tool" type="button" onClick={onReset}>Reset</button>
        </div>
        <div className="presentation-voice-dock">
          <button
            className={`presentation-mic presentation-mic--${voiceState}`}
            type="button"
            onClick={onToggleVoice}
            aria-label={voiceState === "listening" ? "Stop listening" : "Start voice conversation"}
          >
            <span aria-hidden="true">⌁</span>
          </button>
          <div className={`presentation-caption presentation-caption--${voiceState}`} aria-live="polite">
            <span>{voiceLabels[voiceState]}</span>
            <p>{voiceState === "speaking" ? assistantResponse : transcript}</p>
            {voiceError ? (
              <div className="presentation-error" role="alert">
                <p>{voiceError}</p>
                <button type="button" onClick={onRetryVoice}>Try again</button>
              </div>
            ) : null}
          </div>
        </div>
        <p className="presentation-shortcut">Escape closes an overlay or exits</p>
      </footer>

      {overlay ? (
        <div className="presentation-overlay" id="presentation-overlay" role="dialog" aria-modal="false" aria-label={`${overlay} overlay`}>
          <div className="presentation-overlay-header">
            <h2>{overlay === "controls" ? "Experiment controls" : overlay === "history" ? "Conversation history" : "Verification"}</h2>
            <button ref={closeButtonRef} className="presentation-tool" type="button" onClick={closeOverlay}>Close</button>
          </div>
          {overlay === "controls" ? (
            <Controls scene={scene} isPlaying={isPlaying} onChange={onChangeScene} onTogglePlay={onTogglePlay} onReset={onReset} />
          ) : null}
          {overlay === "history" ? (
            voiceHistory.length ? (
              <ol className="presentation-history">
                {voiceHistory.map((message, index) => <li key={`${message.speaker}-${index}`}><strong>{message.speaker}</strong><p>{message.text}</p></li>)}
              </ol>
            ) : <p className="presentation-empty">No completed voice turns yet.</p>
          ) : null}
          {overlay === "results" ? <ResultsPanel scene={scene} verdict={verdict} isVerifying={isVerifying} /> : null}
        </div>
      ) : null}
    </section>
  );
}
