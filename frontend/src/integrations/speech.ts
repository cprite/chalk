import { useCallback, useEffect, useRef } from "react";

type SpeechHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  /** Recognition ended. `heard` is false when no final phrase arrived. */
  onEnd: (heard: boolean) => void;
};

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Chrome blocked the microphone. Allow it next to the address bar, or type instead.",
  "service-not-allowed": "Chrome blocked the microphone. Allow it next to the address bar, or type instead.",
  "audio-capture": "No microphone found. Connect one, or type instead.",
  network: "Speech recognition needs internet. Check the connection, or type instead.",
};

/**
 * One browser speech session per press of the mic. Handlers live in a ref so that
 * re-rendering the app never recreates recognition and cuts the speaker off.
 */
export function useSpeechRecognition(handlers: SpeechHandlers) {
  const handlersRef = useRef(handlers);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      handlersRef.current.onError("Voice input needs Chrome. Type your question instead.");
      return false;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let heard = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = Array.from(event.results) as any[];
      const text = results.map((result) => result[0].transcript).join("").trim();
      if (!text) return;
      if (results[results.length - 1].isFinal) {
        heard = true;
        handlersRef.current.onFinal(text);
      } else {
        handlersRef.current.onInterim(text);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const message = ERROR_MESSAGES[event.error];
      if (message) handlersRef.current.onError(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      handlersRef.current.onEnd(heard);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      handlersRef.current.onError("Could not start the microphone. Try again, or type instead.");
      return false;
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return { start, stop };
}
