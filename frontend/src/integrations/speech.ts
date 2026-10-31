import { useCallback, useEffect, useRef } from "react";
import { transcribeAudio } from "./backend";

type SpeechHandlers = {
  onTranscribing: () => void;
  onFinal: (text: string) => void;
  onNothingHeard: () => void;
  onError: (message: string) => void;
};

const MAX_RECORDING_MS = 20000;
// Below this peak RMS level the recording is silence. The model invents words for silence, so it is never sent.
const MIN_SPEECH_LEVEL = 0.01;

/** Tracks the loudest moment of a stream. Call the returned function to get it and stop listening. */
function watchLevel(stream: MediaStream) {
  const context = new AudioContext();
  void context.resume();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let peak = 0;
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    peak = Math.max(peak, Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length));
  }, 50);
  return () => {
    clearInterval(timer);
    // If the browser kept the analyser suspended the level means nothing, so never block the recording.
    const measured = context.state === "running";
    void context.close();
    return measured ? peak : Infinity;
  };
}

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: "The browser blocked the microphone. Allow it next to the address bar, or type instead.",
  NotFoundError: "No microphone found. Connect one, or type instead.",
  NotReadableError: "Another app is using the microphone. Close it, or type instead.",
};

/**
 * Records one phrase per press of the mic and has the backend transcribe it with Gemini.
 * Browser speech recognition is avoided because it fails on networks that block Google's speech servers.
 */
export function useSpeechRecognition(handlers: SpeechHandlers) {
  const handlersRef = useRef(handlers);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stopRequestedRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      handlersRef.current.onError("This browser cannot record audio. Type your question instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      handlersRef.current.onError(MIC_ERRORS[name] ?? "Could not start the microphone. Type your question instead.");
      return;
    }

    // The user pressed stop while the browser was still opening the microphone.
    if (stopRequestedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      handlersRef.current.onNothingHeard();
      return;
    }

    const finishLevel = watchLevel(stream);
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      if (finishLevel() < MIN_SPEECH_LEVEL) {
        handlersRef.current.onNothingHeard();
        return;
      }
      handlersRef.current.onTranscribing();
      try {
        const text = await transcribeAudio(new Blob(chunks, { type: recorder.mimeType }));
        if (text) handlersRef.current.onFinal(text);
        else handlersRef.current.onNothingHeard();
      } catch (error) {
        handlersRef.current.onError(error instanceof Error ? error.message : "Could not transcribe that. Type instead.");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
  }, [stop]);

  return { start, stop };
}
