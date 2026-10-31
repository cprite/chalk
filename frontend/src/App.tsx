import { useEffect, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { PhysicsScene } from "./components/PhysicsScene";
import { PresentationStage } from "./components/PresentationStage";
import { ResultsPanel } from "./components/ResultsPanel";
import { SketchPanel } from "./components/SketchPanel";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { analyzeSketch, createDemoScene, verifySimulation } from "./integrations/mock";
import { executeVoiceTurn } from "./integrations/live";
import { dismissPresentationOverlay } from "./presentation";
import { getSketchImageValidationError } from "./sketchFile";
import type { PresentationOverlay } from "./presentation";
import type { InclineSceneSpec, VerificationVerdict, VoiceState } from "./types";

const initialScene = createDemoScene();

type VoiceMessage = {
  speaker: "You" | "Chalk";
  text: string;
};

export default function App() {
  const presentationRootRef = useRef<HTMLElement>(null);
  const [scene, setScene] = useState<InclineSceneSpec>(initialScene);
  const [sceneSource, setSceneSource] = useState<"live" | "demo">("demo");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSuccess, setAnalysisSuccess] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verdict, setVerdict] = useState<VerificationVerdict | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("What happens if I double the mass?");
  const [assistantResponse, setAssistantResponse] = useState(
    "Try a prediction first: if we double the mass, do you expect the ball to arrive sooner?",
  );
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presentationOverlay, setPresentationOverlay] = useState<PresentationOverlay>(null);
  const [voiceHistory, setVoiceHistory] = useState<VoiceMessage[]>([]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      const isRootFullscreen = document.fullscreenElement === presentationRootRef.current;
      setIsFullscreen(isRootFullscreen);
      setIsPresentationMode(isRootFullscreen);
      if (!isRootFullscreen) setPresentationOverlay(dismissPresentationOverlay());
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const exitWindowedPresentation = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isPresentationMode) return;
      if (presentationOverlay) {
        setPresentationOverlay(dismissPresentationOverlay());
      } else if (!isFullscreen) {
        setIsPresentationMode(false);
      }
    };

    window.addEventListener("keydown", exitWindowedPresentation);
    return () => window.removeEventListener("keydown", exitWindowedPresentation);
  }, [isFullscreen, isPresentationMode, presentationOverlay]);

  const analyzeWithFile = async (targetFile: File) => {
    setIsAnalyzing(true);
    setInputError(null);
    setAnalysisSuccess(null);
    try {
      const analysis = await analyzeSketch(targetFile);
      setScene(analysis.scene);
      setSceneSource(analysis.source);
      setVerdict(null);
      setAnalysisSuccess(
        `Live analysis: ${analysis.scene.angle_deg}° slope · ${analysis.scene.mass} kg ${analysis.scene.body}`,
      );
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "We could not read that sketch. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectFile = (selected: File) => {
    setInputError(null);
    setPreviewError(null);
    setAnalysisSuccess(null);
    const validationError = getSketchImageValidationError(selected);
    if (validationError) {
      setInputError(validationError);
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(selected);
    previewUrlRef.current = nextPreviewUrl;
    setFile(selected);
    setPreviewUrl(nextPreviewUrl);
    void analyzeWithFile(selected);
  };

  const handlePreviewError = (failedUrl: string) => {
    if (previewUrlRef.current !== failedUrl) return;
    URL.revokeObjectURL(failedUrl);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
    setPreviewError("We could not display that image. Choose a different PNG or JPEG sketch.");
  };

  const selectPreset = async (url: string, name: string) => {
    try {
      setInputError(null);
      setPreviewError(null);
      setAnalysisSuccess(null);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Preset request failed (${response.status}).`);
      const blob = await response.blob();
      const presetFile = new File([blob], name, { type: "image/png" });
      setFile(presetFile);
      await analyzeWithFile(presetFile);
    } catch (error) {
      setInputError(`Could not load preset sketch: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const analyze = async () => {
    if (!file) return;
    await analyzeWithFile(file);
  };

  const runVerification = async (sceneToVerify = scene) => {
    setIsVerifying(true);
    try {
      setVerdict(await verifySimulation(sceneToVerify));
    } finally {
      setIsVerifying(false);
    }
  };

  const togglePlay = () => {
    setIsPlaying((playing) => !playing);
    if (!isPlaying) void runVerification();
  };

  const handleVoiceCommand = async (command: string) => {
    setVoiceError(null);
    setTranscript(command);
    try {
      const turn = await executeVoiceTurn(command, setVoiceState, scene);
      setAssistantResponse(turn.text);
      setVoiceHistory((history) => [...history, { speaker: "You", text: command }, { speaker: "Chalk", text: turn.text }]);
      const nextScene = turn.updatedScene && Object.keys(turn.updatedScene).length > 0
        ? { ...scene, ...turn.updatedScene }
        : scene;
      if (nextScene !== scene) {
        setScene(nextScene);
        setVerdict(null);
      }
      if (turn.shouldPlay !== undefined) {
        setIsPlaying(turn.shouldPlay);
        if (turn.shouldPlay) void runVerification(nextScene);
      }
    } catch (error) {
      setVoiceState("error");
      setVoiceError(error instanceof Error ? error.message : "Voice command failed. Try again.");
    }
  };

  const toggleVoice = () => {
    if (voiceState === "listening") {
      void handleVoiceCommand(transcript);
      return;
    }
    setVoiceError(null);
    setVoiceState("listening");
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
    setPresentationOverlay(dismissPresentationOverlay());
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

  const changeScene = (field: "angle_deg" | "mass" | "gravity", value: number) => {
    setScene((current) => ({ ...current, [field]: value }));
    setVerdict(null);
  };

  const changeBody = (body: "ball" | "block") => {
    setScene((current) => ({ ...current, body }));
    setVerdict(null);
  };

  const resetScene = () => {
    setScene(initialScene);
    setSceneSource("demo");
    setIsPlaying(false);
    setVerdict(null);
    setAnalysisSuccess(null);
  };

  const useDemoScene = () => {
    setScene(createDemoScene());
    setSceneSource("demo");
    setVerdict(null);
    setInputError(null);
    setAnalysisSuccess(null);
  };

  return (
    <main
      className={`app-shell${isPresentationMode ? " app-shell--presentation" : ""}`}
      ref={presentationRootRef}
    >
      {isPresentationMode ? (
        <PresentationStage
          scene={scene}
          isPlaying={isPlaying}
          isVerifying={isVerifying}
          verdict={verdict}
          voiceState={voiceState}
          voiceError={voiceError}
          transcript={transcript}
          assistantResponse={assistantResponse}
          voiceHistory={voiceHistory}
          overlay={presentationOverlay}
          onOverlayChange={setPresentationOverlay}
          onChangeScene={changeScene}
          onChangeBody={changeBody}
          onTogglePlay={togglePlay}
          onReset={resetScene}
          onToggleVoice={toggleVoice}
          onRetryVoice={() => { setVoiceError(null); setVoiceState("idle"); }}
          onExit={() => void exitPresentationMode()}
        />
      ) : <>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Chalk home">chalk<span>.</span></a>
        <p className="tagline">Physics you can talk to.</p>
        <div className="mode-badge"><i /> Live CAD & Voice Lab</div>
      </header>

      <section className="intro" id="top">
        <p className="eyebrow">INTERACTIVE LAB / 01</p>
        <h1>Turn a sketch into an experiment.</h1>
        <p>Show Chalk a physics problem, ask a question out loud, then check what really happens.</p>
      </section>

      <section className="lab-grid" aria-label="Chalk physics lab">
        <SketchPanel
          previewUrl={previewUrl}
          fileName={file?.name ?? null}
          isAnalyzing={isAnalyzing}
          analysisSuccess={analysisSuccess}
          error={inputError}
          previewError={previewError}
          sceneSource={sceneSource}
          onSelectFile={selectFile}
          onPreviewError={handlePreviewError}
          onAnalyze={() => void analyze()}
          onRetry={() => void analyze()}
          onUseDemo={useDemoScene}
          onSelectPreset={selectPreset}
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
          <PhysicsScene
            scene={scene}
            isPlaying={isPlaying}
            onChangeBody={changeBody}
          />
          <Controls
            scene={scene}
            isPlaying={isPlaying}
            onChange={changeScene}
            onTogglePlay={togglePlay}
            onReset={resetScene}
          />
        </section>

        <VoiceAssistant
          state={voiceState}
          transcript={transcript}
          assistantResponse={assistantResponse}
          error={voiceError}
          onToggleMicrophone={toggleVoice}
          onSubmitCommand={handleVoiceCommand}
          onRetry={() => { setVoiceError(null); setVoiceState("idle"); }}
        />
      </section>

      <ResultsPanel scene={scene} verdict={verdict} isVerifying={isVerifying} />
      </>}
    </main>
  );
}
