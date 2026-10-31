import type { VoiceState } from "../types";

type VoiceAssistantProps = {
  state: VoiceState;
  transcript: string;
  error: string | null;
  onToggleMicrophone: () => void;
  onRetry: () => void;
};

const stateLabel: Record<VoiceState, string> = {
  idle: "Ready to listen",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Voice unavailable",
};

export function VoiceAssistant({ state, transcript, error, onToggleMicrophone, onRetry }: VoiceAssistantProps) {
  return (
    <section className="panel voice-panel" aria-labelledby="voice-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">03 / ASK CHALK</p>
          <h2 id="voice-title">Voice tutor</h2>
        </div>
        <span className={`voice-status voice-status--${state}`}><i />{stateLabel[state]}</span>
      </div>

      <div className="transcript" aria-live="polite">
        <p className="speaker speaker--you">YOU</p>
        <p>{transcript}</p>
        <div className="answer">
          <p className="speaker speaker--chalk">CHALK</p>
          <p>Try a prediction first: if we double the mass, do you expect the ball to arrive sooner?</p>
        </div>
      </div>

      {error ? (
        <div className="voice-error" role="alert">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={onRetry}>Try again</button>
        </div>
      ) : null}

      <button
        className={`mic-button mic-button--${state}`}
        type="button"
        onClick={onToggleMicrophone}
        aria-label={state === "listening" ? "Stop listening" : "Start voice conversation"}
      >
        <span aria-hidden="true">⌁</span>
      </button>
      <p className="mic-hint">{state === "listening" ? "Tap to stop" : "Tap to ask a question"}</p>
    </section>
  );
}
