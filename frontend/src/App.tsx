import { useEffect, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { PhysicsScene } from "./components/PhysicsScene";
import { ResultsPanel } from "./components/ResultsPanel";
import { SketchPanel } from "./components/SketchPanel";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { analyzeSketch, createDemoScene, verifySimulation } from "./integrations/mock";
import { completeVoiceTurn } from "./integrations/live";
import type { InclineSceneSpec, VerificationVerdict, VoiceState } from "./types";

const initialScene = createDemoScene();

export default function App() {
  const presentationRootRef = useRef<HTMLElement>(null);
  const [scene, setScene] = useState<InclineSceneSpec>(initialScene);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verdict, setVerdict] = useState<VerificationVerdict | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("What happens if I make the ramp steeper?");
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const isRootFullscreen = document.fullscreenElement === presentationRootRef.current;
      setIsFullscreen(isRootFullscreen);
      setIsPresentationMode(isRootFullscreen);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const exitWindowedPresentation = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isPresentationMode && !isFullscreen) {
        setIsPresentationMode(false);
      }
    };

    window.addEventListener("keydown", exitWindowedPresentation);
    return () => window.removeEventListener("keydown", exitWindowedPresentation);
  }, [isFullscreen, isPresentationMode]);

  const selectFile = (selected: File) => {
    setInputError(null);
    if (!selected.type.startsWith("image/")) {
      setInputError("Upload a PNG or JPEG image of your physics sketch.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setInputError("Your image is over the 5 MB limit. Choose a smaller file.");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const analyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setInputError(null);
    try {
      setScene(await analyzeSketch(file));
      setVerdict(null);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "We could not read that sketch. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runVerification = async () => {
    setIsVerifying(true);
    try {
      setVerdict(await verifySimulation(scene));
    } finally {
      setIsVerifying(false);
    }
  };

  const togglePlay = () => {
    setIsPlaying((playing) => !playing);
    if (!isPlaying) void runVerification();
  };

  const toggleVoice = () => {
    if (voiceState === "listening") {
      void (async () => {
        try {
          const answer = await completeVoiceTurn(transcript, setVoiceState);
          setTranscript(answer);
        } catch (error) {
          setVoiceState("error");
          setVoiceError(error instanceof Error ? error.message : "Voice connection failed. Try again.");
        }
      })();
      return;
    }
    setVoiceError(null);
    setVoiceState("listening");
    setTranscript("What happens if I make the ramp steeper?");
  };

  const enterPresentationMode = async () => {
    setIsPresentationMode(true);
    const root = presentationRootRef.current;
    if (!root?.requestFullscreen) return;

    try {
      await root.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const exitPresentationMode = async () => {
    if (document.fullscreenElement === presentationRootRef.current && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {
        setIsFullscreen(false);
        setIsPresentationMode(false);
      }
      return;
    }

    setIsPresentationMode(false);
  };

  return (
    <main
      className={`app-shell${isPresentationMode ? " app-shell--presentation" : ""}`}
      ref={presentationRootRef}
    >
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Chalk home">chalk<span>.</span></a>
        <p className="tagline">Physics you can talk to.</p>
        <div className="mode-badge"><i /> Demo-safe mock mode</div>
      </header>

      {!isPresentationMode ? (
        <section className="intro" id="top">
          <p className="eyebrow">INTERACTIVE LAB / 01</p>
          <h1>Turn a sketch into an experiment.</h1>
          <p>Show Chalk a physics problem, ask a question out loud, then check what really happens.</p>
        </section>
      ) : (
        <p className="presentation-instructions" role="status">
          {isFullscreen ? "Presentation fullscreen — press Escape to exit." : "Presentation layout — fullscreen is unavailable; press Escape to exit."}
        </p>
      )}

      <section className="lab-grid" aria-label="Chalk physics lab">
        <SketchPanel
          previewUrl={previewUrl}
          fileName={file?.name ?? null}
          isAnalyzing={isAnalyzing}
          error={inputError}
          onSelectFile={selectFile}
          onAnalyze={() => void analyze()}
          onCameraRequest={() => setInputError("Camera access will connect to Gemini Live. Upload a photo for this demo mode.")}
        />

        <section className="simulation-panel" aria-labelledby="simulation-title">
          <div className="simulation-heading">
            <div><p className="eyebrow">02 / EXPERIMENT</p><h2 id="simulation-title">Inclined plane</h2></div>
            <div className="simulation-actions">
              <span className="live-chip"><i /> {isPlaying ? "Running" : "Ready"}</span>
              <button
                className="button button--secondary presentation-button"
                type="button"
                onClick={() => void (isPresentationMode ? exitPresentationMode() : enterPresentationMode())}
                aria-pressed={isPresentationMode}
              >
                <span aria-hidden="true">{isPresentationMode ? "↙" : "⛶"}</span> {isPresentationMode ? "Exit presentation" : "Present"}
              </button>
            </div>
          </div>
          <PhysicsScene scene={scene} isPlaying={isPlaying} />
          <Controls
            scene={scene}
            isPlaying={isPlaying}
            onChange={(field, value) => { setScene((current) => ({ ...current, [field]: value })); setVerdict(null); }}
            onTogglePlay={togglePlay}
            onReset={() => { setScene(initialScene); setIsPlaying(false); setVerdict(null); }}
          />
        </section>

        <VoiceAssistant
          state={voiceState}
          transcript={transcript}
          error={voiceError}
          onToggleMicrophone={toggleVoice}
          onRetry={() => { setVoiceError(null); setVoiceState("idle"); }}
        />
      </section>

      <ResultsPanel scene={scene} verdict={verdict} isVerifying={isVerifying} />
    </main>
  );
}
