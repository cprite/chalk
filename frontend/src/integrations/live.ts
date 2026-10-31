import type { VoiceState } from "../types";

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Demo-safe substitute for Gemini Live. It models the UI state transitions and
 * callback shape without requesting microphone permission or exposing a key.
 */
export async function completeVoiceTurn(
  prompt: string,
  onStateChange: (state: VoiceState) => void,
): Promise<string> {
  if (!prompt.trim()) throw new Error("Ask Chalk a question before sending it.");

  onStateChange("thinking");
  await wait(500);
  onStateChange("speaking");
  return "A steeper ramp increases the component of gravity along the plane, so the ball accelerates more quickly.";
}
