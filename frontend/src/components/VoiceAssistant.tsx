import { useEffect, useRef, useState } from "react";
import type { VoiceState } from "../types";

type VoiceAssistantProps = {
  state: VoiceState;
  transcript: string;
  assistantResponse?: string;
  error: string | null;
  onToggleMicrophone: () => void;
  onSubmitCommand?: (command: string) => void;
  onRetry: () => void;
};

const stateLabel: Record<VoiceState, string> = {
  idle: "Ready to listen",
  listening: "Listening with mic…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Voice unavailable",
};

const QUICK_COMMANDS = [
  "Double the mass",
  "3 Springs in Parallel",
  "4 Springs in Series",
  "Make ramp steeper",
  "Swap to sliding block",
  "Moon gravity",
  "Run simulation",
];

export function VoiceAssistant({
  state,
  transcript,
  assistantResponse,
  error,
  onToggleMicrophone,
  onSubmitCommand,
  onRetry,
}: VoiceAssistantProps) {
  const [customText, setCustomText] = useState("");
  const recognitionRef = useRef<any>(null);

  // Set up Web Speech API recognition when available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const currentTranscript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        if (currentTranscript && onSubmitCommand) {
          const isFinal = event.results[event.results.length - 1].isFinal;
          if (isFinal) {
            onSubmitCommand(currentTranscript);
          }
        }
      };

      recognition.onerror = () => {
        // Recognition error handled gracefully
      };

      recognitionRef.current = recognition;
    } catch {
      // SpeechRecognition not supported or disabled
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [onSubmitCommand]);

  const handleMicClick = () => {
    if (state === "listening") {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      onToggleMicrophone();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
      onToggleMicrophone();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customText.trim()) return;
    if (onSubmitCommand) {
      onSubmitCommand(customText.trim());
      setCustomText("");
    }
  };

  const answer =
    assistantResponse ||
    "Try a prediction first: if we double the mass, do you expect the ball to arrive sooner?";

  return (
    <section className="panel voice-panel" aria-labelledby="voice-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">03 / ASK CHALK</p>
          <h2 id="voice-title">Voice tutor</h2>
        </div>
        <span className={`voice-status voice-status--${state}`}>
          <i />
          {stateLabel[state]}
        </span>
      </div>

      <div className="transcript" aria-live="polite">
        <p className="speaker speaker--you">YOU (VOICE / COMMAND)</p>
        <p>{transcript || "Ask a question or issue a voice command…"}</p>
        <div className="answer">
          <p className="speaker speaker--chalk">CHALK AI</p>
          <p>{answer}</p>
        </div>
      </div>

      {error ? (
        <div className="voice-error" role="alert">
          <p>{error}</p>
          <button type="button" className="text-button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {/* Quick Suggestion Chips (Hackathon Stage Safety Net) */}
      <div style={{ margin: "8px 0 14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => onSubmitCommand && onSubmitCommand(cmd)}
            style={{
              padding: "4px 8px",
              border: "1px solid #c9cfc0",
              borderRadius: "12px",
              background: "#f0eee3",
              color: "#314d3e",
              fontSize: "0.68rem",
              fontFamily: '"DM Mono", monospace',
              cursor: "pointer",
            }}
          >
            💬 {cmd}
          </button>
        ))}
      </div>

      {/* Manual Prompt Input for quiet stage testing */}
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "6px", marginBottom: "14px" }}
      >
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder='Say or type e.g. "double the mass"'
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "1px solid #c9cfc0",
            borderRadius: "2px",
            background: "#fff",
            fontSize: "0.75rem",
          }}
        />
        <button
          type="submit"
          className="button button--secondary"
          style={{ minHeight: "32px", padding: "0 10px", fontSize: "0.72rem" }}
        >
          Ask
        </button>
      </form>

      <button
        className={`mic-button mic-button--${state}`}
        type="button"
        onClick={handleMicClick}
        aria-label={state === "listening" ? "Stop listening" : "Start voice conversation"}
      >
        <span aria-hidden="true">⌁</span>
      </button>
      <p className="mic-hint">
        {state === "listening"
          ? "Listening via mic… Tap to stop"
          : 'Tap mic or say "Double the mass"'}
      </p>
    </section>
  );
}
