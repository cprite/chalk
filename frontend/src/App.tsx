import { useEffect, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { PhysicsScene, type CadPreviewMode } from "./components/PhysicsScene";
import { PresentationStage } from "./components/PresentationStage";
import { ResultsPanel } from "./components/ResultsPanel";
import { SketchPanel } from "./components/SketchPanel";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { analyzeSketch, BackendError, createDemoScene, explainResult, recordPrediction, sendFollowup, verifyMeasurement } from "./integrations/backend";
import { parseVoiceIntent } from "./integrations/live";
import { useSpeechRecognition } from "./integrations/speech";
import { measureIncline, measureSpring } from "./physics/rapierMeasure";
import { dismissPresentationOverlay } from "./presentation";
import { getSketchImageValidationError } from "./sketchFile";
import type { PresentationOverlay } from "./presentation";
import type { Collision1DSceneSpec, GenerativeSceneSpec, InclineSceneSpec, SceneSpec, SpringSceneSpec, VerificationVerdict, VoiceState } from "./types";

const initialScene = createDemoScene();

// JavaScript's \\b only understands Latin letters, so it cannot end a Russian word.
export const startsWithWord = (text: string, words: string) =>
  new RegExp(`^(${words})(?=[\\s,.:!?]|$)`, "i").test(text);

type VoiceMessage = {
  speaker: "You" | "Chalk";
  text: string;
};

export default function App() {
  const presentationRootRef = useRef<HTMLElement>(null);
  const [scene, setScene] = useState<SceneSpec>(initialScene);
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
  const [transcript, setTranscript] = useState("");
  const [assistantResponse, setAssistantResponse] = useState(
    "Try a prediction first: if we double the mass, do you expect the ball to arrive sooner?",
  );
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presentationOverlay, setPresentationOverlay] = useState<PresentationOverlay>(null);
  const [voiceHistory, setVoiceHistory] = useState<VoiceMessage[]>([]);
  const [prediction, setPrediction] = useState<string | null>(null);
  const latestTurn = useRef(0);

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
      if (analysis.scene.scenario === "spring") {
        const spr = analysis.scene as SpringSceneSpec;
        setAnalysisSuccess(
          `Live analysis: ${spr.spring_count} springs in ${spr.arrangement} · ${spr.mass} kg (k_eff = ${spr.spring_constant.toFixed(0)} N/m)`
        );
      } else if (analysis.scene.scenario === "collision_1d") {
        const col = analysis.scene as Collision1DSceneSpec;
        setAnalysisSuccess(
          `Live analysis: 1D collision · Cart A: ${col.mass_a} kg (${col.velocity_a} m/s) · Cart B: ${col.mass_b} kg (${col.velocity_b} m/s)`
        );
      } else if (analysis.scene.scenario === "generative") {
        const gen = analysis.scene as GenerativeSceneSpec;
        setAnalysisSuccess(
          `Live analysis: ${gen.title} · ${gen.primary_law}`
        );
      } else {
        const inc = analysis.scene as InclineSceneSpec;
        setAnalysisSuccess(
          `Live analysis: ${inc.angle_deg}° slope · ${inc.mass} kg ${inc.body}`
        );
      }
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

  const say = (command: string, text: string) => {
    setAssistantResponse(text);
    setVoiceHistory((history) => [...history, { speaker: "You", text: command }, { speaker: "Chalk", text }]);
    setVoiceState("speaking");
  };

  const runVerification = async (sceneToVerify = scene) => {
    const turn = ++latestTurn.current;
    setIsVerifying(true);
    try {
      if (sceneToVerify.scenario !== "incline" && sceneToVerify.scenario !== "spring") {
        throw new Error("This scenario has no check yet.");
      }
      const measured = sceneToVerify.scenario === "spring"
        ? await measureSpring(sceneToVerify)
        : await measureIncline(sceneToVerify);
      const result = await verifyMeasurement(sceneToVerify, measured);
      setVerdict(result.verdict);
      const text = await explainResult(sceneToVerify, result.raw, prediction);
      // The user moved on while the model was answering, so this explanation is out of date.
      if (turn !== latestTurn.current) return;
      setAssistantResponse(text);
      setVoiceHistory((history) => [...history, { speaker: "Chalk", text }]);
    } catch (error) {
      setVerdict({
        status: "not_applicable",
        expectedSeconds: 0,
        measuredSeconds: 0,
        errorPct: 0,
        tolerancePct: 2,
        explanation: error instanceof Error ? error.message : "The check did not run.",
      });
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
    const text = command.trim();
    if (!text) return;
    latestTurn.current += 1;

    // Instant local controls: no model call, so they work the moment the button would.
    if (startsWithWord(text, "run|start|play|запусти|пуск|старт")) {
      say(command, "Launching the simulation.");
      setIsPlaying(true);
      void runVerification();
      return;
    }
    if (startsWithWord(text, "pause|stop|halt|пауза|стоп")) {
      say(command, "Paused the simulation.");
      setIsPlaying(false);
      return;
    }
    if (startsWithWord(text, "i think|i predict|prediction|думаю|я думаю|прогноз")) {
      setPrediction(text);
      say(command, "Prediction recorded. Run the simulation to test it.");
      void recordPrediction(text).catch(() => undefined);
      return;
    }

    // Spring assembly layouts are a visual CAD preview, handled by the local parser.
    if (/springs? in|series|parallel|hooke|oscillator|пружин/i.test(text)) {
      const local = parseVoiceIntent(text, scene as any);
      if (Object.keys(local.updates).length > 0) {
        setScene({ ...scene, ...local.updates } as SceneSpec);
        setVerdict(null);
      }
      say(command, local.explanation);
      return;
    }

    setVoiceState("thinking");
    try {
      const result = await sendFollowup(scene, text);
      if (result.reply) {
        say(command, result.reply);
        return;
      }
      setScene(result.scene);
      setVerdict(null);
      setIsPlaying(false);
      const changed = result.changes.map((c) => `${c.field} = ${c.value}`).join(", ");
      say(command, changed ? `Changed ${changed}. What do you predict will happen?` : "New experiment ready. What do you predict will happen?");
    } catch (error) {
      if (error instanceof BackendError && error.code !== "model_unavailable" && error.code !== "backend_unavailable") {
        say(command, error.message);
        return;
      }
      // Model or backend is down: fall back to the phrases we can read locally.
      const local = parseVoiceIntent(text, scene as any);
      if (Object.keys(local.updates).length > 0) {
        setScene({ ...scene, ...local.updates } as SceneSpec);
        setVerdict(null);
        say(command, local.explanation);
      } else {
        setVoiceState("error");
        setVoiceError(error instanceof Error ? error.message : "Voice command failed. Try again.");
      }
    }
  };

  const speech = useSpeechRecognition({
    onTranscribing: () => setVoiceState("thinking"),
    onFinal: (text) => void handleVoiceCommand(text),
    onNothingHeard: () => {
      setVoiceState("idle");
      setVoiceError("I didn't catch that. Try again, closer to the microphone.");
    },
    onError: (message) => {
      setVoiceState("error");
      setVoiceError(message);
    },
  });

  const toggleVoice = () => {
    if (voiceState === "listening") {
      // The browser delivers whatever it heard as a final result, then ends.
      speech.stop();
      return;
    }
    setVoiceError(null);
    setTranscript("");
    setVoiceState("listening");
    void speech.start();
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

  const changeScene = (field: string, value: any) => {
    setScene((current) => ({ ...current, [field]: value } as SceneSpec));
    setVerdict(null);
  };

  const changeBody = (body: "ball" | "block") => {
    if (scene.scenario === "incline") {
      setScene((current) => ({ ...current, body } as SceneSpec));
      setVerdict(null);
    }
  };

  const handleSelectCadMode = (mode: CadPreviewMode) => {
    setVerdict(null);
    if (mode === "incline") {
      setScene({
        scenario: "incline",
        mass: scene.scenario === "incline" ? scene.mass : 1.0,
        angle_deg: scene.scenario === "incline" ? scene.angle_deg : 30,
        gravity: scene.gravity ?? 9.81,
        friction: scene.scenario === "incline" ? scene.friction : 0.12,
        body: scene.scenario === "incline" ? scene.body : "block",
        length: 3.2,
        confidence: 1.0,
        assumptions: [],
      });
    } else if (mode === "spring") {
      setScene({
        scenario: "spring",
        mass: scene.scenario === "spring" ? scene.mass : 2.0,
        spring_constant: scene.scenario === "spring" ? scene.spring_constant : 120,
        spring_count: scene.scenario === "spring" ? scene.spring_count : 2,
        arrangement: scene.scenario === "spring" ? scene.arrangement : "series",
        amplitude: 0.35,
        gravity: scene.gravity ?? 9.81,
        confidence: 1.0,
        assumptions: [],
      });
    } else if (mode === "collision_1d") {
      setScene({
        scenario: "collision_1d",
        mass_a: scene.scenario === "collision_1d" ? scene.mass_a : 2.0,
        mass_b: scene.scenario === "collision_1d" ? scene.mass_b : 1.0,
        velocity_a: scene.scenario === "collision_1d" ? scene.velocity_a : 10.0,
        velocity_b: scene.scenario === "collision_1d" ? scene.velocity_b : 5.0,
        restitution: scene.scenario === "collision_1d" ? scene.restitution : 1.0,
        gravity: scene.gravity ?? 9.81,
        confidence: 1.0,
        assumptions: [],
      });
    } else if (mode === "projectile") {
      setScene({
        scenario: "incline",
        mass: 1.0,
        angle_deg: 45,
        gravity: scene.gravity ?? 9.81,
        friction: 0.0,
        body: "ball",
        length: 3.2,
        confidence: 1.0,
        assumptions: [],
      });
    }
  };

  const resetScene = () => {
    setScene(initialScene);
    setSceneSource("demo");
    setPrediction(null);
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
            <div>
              <p className="eyebrow">02 / EXPERIMENT</p>
              <h2 id="simulation-title">
                {scene.scenario === "spring"
                  ? "Vertical spring oscillator"
                  : scene.scenario === "collision_1d"
                  ? "1D Linear Momentum Collision"
                  : scene.scenario === "generative"
                  ? (scene as GenerativeSceneSpec).title || "Generative Physics Apparatus"
                  : "Inclined plane"}
              </h2>
            </div>
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
            onSelectCadMode={handleSelectCadMode}
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
