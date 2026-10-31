import { useEffect, useState } from "react";
import { Controls } from "./components/Controls";
import { PhysicsScene } from "./components/PhysicsScene";
import { ResultsPanel } from "./components/ResultsPanel";
import { SketchPanel } from "./components/SketchPanel";
import { VoiceAssistant } from "./components/VoiceAssistant";
import { analyzeSketch, createDemoScene, verifySimulation } from "./integrations/mock";
import { executeVoiceTurn } from "./integrations/live";
import type { InclineSceneSpec, VerificationVerdict, VoiceState } from "./types";

const initialScene = createDemoScene();

export default function App() {
  const [scene, setScene] = useState<InclineSceneSpec>(initialScene);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  const [assistantResponse, setAssistantResponse] = useState<string>(
    "Try a prediction first: if we double the mass, do you expect the ball to arrive sooner?"
  );

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const analyzeWithFile = async (targetFile: File) => {
    setIsAnalyzing(true);
    setInputError(null);
    setAnalysisSuccess(null);
    try {
      const parsed = await analyzeSketch(targetFile);
      setScene(parsed);
      setVerdict(null);
      setAnalysisSuccess(
        `Gemini 4 Argon: ${parsed.angle_deg}° slope · ${parsed.mass} kg ${parsed.body}`
      );
    } catch (error) {
      setInputError(error instanceof Error ? error.message : "We could not read that sketch. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectFile = (selected: File) => {
    setInputError(null);
    setAnalysisSuccess(null);
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
    // Immediately analyze sketch upon upload without requiring extra clicks
    void analyzeWithFile(selected);
  };

  const selectPreset = async (url: string, name: string) => {
    try {
      setInputError(null);
      setAnalysisSuccess(null);
      setPreviewUrl(url);
      const res = await fetch(url);
      const blob = await res.blob();
      const presetFile = new File([blob], name, { type: "image/png" });
      setFile(presetFile);
      await analyzeWithFile(presetFile);
    } catch (err: any) {
      setInputError("Could not load preset sketch: " + (err.message || String(err)));
    }
  };

  const analyze = async () => {
    if (!file) return;
    await analyzeWithFile(file);
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

  const handleVoiceCommand = async (command: string) => {
    setVoiceError(null);
    setTranscript(command);
    try {
      const turn = await executeVoiceTurn(command, setVoiceState, scene);
      setAssistantResponse(turn.text);
      if (turn.updatedScene && Object.keys(turn.updatedScene).length > 0) {
        setScene((current) => ({ ...current, ...turn.updatedScene }));
        setVerdict(null);
      }
      if (turn.shouldPlay !== undefined) {
        setIsPlaying(turn.shouldPlay);
        if (turn.shouldPlay) void runVerification();
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

  return (
    <main className="app-shell">
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
          onSelectFile={selectFile}
          onAnalyze={() => void analyze()}
          onSelectPreset={selectPreset}
        />

        <section className="simulation-panel" aria-labelledby="simulation-title">
          <div className="simulation-heading">
            <div>
              <p className="eyebrow">02 / EXPERIMENT</p>
              <h2 id="simulation-title">Inclined plane</h2>
            </div>
            <span className="live-chip"><i /> {isPlaying ? "Running" : "Ready"}</span>
          </div>
          <PhysicsScene
            scene={scene}
            isPlaying={isPlaying}
            onChangeBody={(body) => {
              setScene((current) => ({ ...current, body }));
              setVerdict(null);
            }}
          />
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
          assistantResponse={assistantResponse}
          error={voiceError}
          onToggleMicrophone={toggleVoice}
          onSubmitCommand={handleVoiceCommand}
          onRetry={() => { setVoiceError(null); setVoiceState("idle"); }}
        />
      </section>

      <ResultsPanel scene={scene} verdict={verdict} isVerifying={isVerifying} />
    </main>
  );
}
