import type { InclineSceneSpec, VoiceState } from "../types";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export type VoiceTurnResult = {
  text: string;
  updatedScene?: Partial<InclineSceneSpec>;
  shouldPlay?: boolean;
};

/**
 * Natural language intent parser & tool calling engine for Chalk 3D.
 * Translates student/teacher speech (e.g. "double the mass", "make ramp steeper")
 * into explicit state mutations and pedagogical explanations.
 */
export function parseVoiceIntent(
  prompt: string,
  scene?: InclineSceneSpec
): {
  explanation: string;
  updates: Partial<InclineSceneSpec>;
  shouldPlay?: boolean;
} {
  const p = prompt.toLowerCase().trim();
  const baseScene: InclineSceneSpec = scene ?? {
    scenario: "incline",
    body: "ball",
    mass: 1,
    angle_deg: 30,
    length: 4,
    friction: 0.12,
    gravity: 9.81,
    confidence: 0.95,
    assumptions: [],
  };

  // 1. Double mass ("double the mass", "make it twice as heavy", "double ball weight")
  if (
    p.includes("double") &&
    (p.includes("mass") || p.includes("weight") || p.includes("ball") || p.includes("heavy") || p.includes("block"))
  ) {
    const newMass = Number((baseScene.mass * 2).toFixed(1));
    return {
      explanation: `Doubled the mass from ${baseScene.mass} kg to ${newMass} kg. In ideal rolling without slipping, acceleration a = (5/7) g sin(θ) is independent of mass, so the arrival time remains identical!`,
      updates: { mass: newMass },
    };
  }

  // 2. Triple mass
  if (p.includes("triple") && (p.includes("mass") || p.includes("weight"))) {
    const newMass = Number((baseScene.mass * 3).toFixed(1));
    return {
      explanation: `Tripled the mass from ${baseScene.mass} kg to ${newMass} kg. The 3D model is now noticeably heavier, but rolling acceleration remains constant.`,
      updates: { mass: newMass },
    };
  }

  // 3. Halve mass ("half the mass", "cut mass in half")
  if ((p.includes("half") || p.includes("halve")) && (p.includes("mass") || p.includes("weight"))) {
    const newMass = Math.max(0.5, Number((baseScene.mass / 2).toFixed(1)));
    return {
      explanation: `Halved the mass to ${newMass} kg.`,
      updates: { mass: newMass },
    };
  }

  // 4. Steeper ramp / increase angle
  if (
    p.includes("steeper") ||
    (p.includes("increase") && (p.includes("angle") || p.includes("ramp") || p.includes("slope")))
  ) {
    const newAngle = Math.min(65, baseScene.angle_deg + 15);
    return {
      explanation: `A steeper ramp increases the component of gravity along the plane, so the ${baseScene.body} accelerates more quickly. Set angle from ${baseScene.angle_deg}° to ${newAngle}°.`,
      updates: { angle_deg: newAngle },
    };
  }

  // 5. Shallower ramp / decrease angle
  if (
    p.includes("shallower") ||
    p.includes("flatter") ||
    (p.includes("decrease") && (p.includes("angle") || p.includes("ramp") || p.includes("slope")))
  ) {
    const newAngle = Math.max(5, baseScene.angle_deg - 10);
    return {
      explanation: `Reduced the ramp incline to ${newAngle}°. A gentler slope decreases the driving gravitational component g sin(θ).`,
      updates: { angle_deg: newAngle },
    };
  }

  // 6. Explicit angle number: e.g. "set angle to 45 degrees"
  const angleMatch = p.match(/(?:angle|ramp)?\s*(?:to\s*)?(\d{1,2})\s*(?:deg|degree|°)/);
  if (angleMatch) {
    const val = parseInt(angleMatch[1], 10);
    if (!isNaN(val) && val >= 5 && val <= 75) {
      return {
        explanation: `Adjusted ramp angle to ${val}°.`,
        updates: { angle_deg: val },
      };
    }
  }

  // 7. Explicit mass number: e.g. "make mass 4 kg"
  const massMatch = p.match(/(?:mass|weight)(?:\s+(?:to|is|=))?\s+(\d+(?:\.\d+)?)/);
  if (massMatch) {
    const val = parseFloat(massMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 100) {
      return {
        explanation: `Set ${baseScene.body} mass to ${val} kg.`,
        updates: { mass: val },
      };
    }
  }

  // 8. Swap body to block
  if (p.includes("block") || p.includes("cube") || p.includes("sled") || p.includes("sliding")) {
    return {
      explanation: `Swapped body to sliding block. Notice that friction μ = ${baseScene.friction} now directly retards motion: a = g(sin θ - μ cos θ).`,
      updates: { body: "block" },
    };
  }

  // 9. Swap body to ball / sphere
  if (p.includes("ball") || p.includes("sphere") || p.includes("rolling")) {
    return {
      explanation: `Swapped body to rolling sphere. Rotational inertia I = 2/5 mr² yields a = (5/7) g sin θ under no-slip conditions.`,
      updates: { body: "ball" },
    };
  }

  // 10. Moon / Space Gravity
  if (p.includes("moon") || p.includes("lunar")) {
    return {
      explanation: `Switched to Lunar gravity (g = 1.62 m/s²). Motion is roughly 6 times slower than on Earth!`,
      updates: { gravity: 1.62 },
    };
  }
  if (p.includes("jupiter")) {
    return {
      explanation: `Switched to Jovian gravity (g = 24.79 m/s²). Extremely high gravitational acceleration!`,
      updates: { gravity: 24.79 },
    };
  }
  if (p.includes("earth")) {
    return {
      explanation: `Reset to Earth gravity (g = 9.81 m/s²).`,
      updates: { gravity: 9.81 },
    };
  }

  // 11. Friction changes
  if (p.includes("frictionless") || p.includes("zero friction") || p.includes("no friction")) {
    return {
      explanation: `Friction removed (μ = 0).`,
      updates: { friction: 0 },
    };
  }

  // 12. Simulation controls
  if (p.includes("run") || p.includes("start") || p.includes("play") || p.includes("launch")) {
    return {
      explanation: `Launching the 3D physics simulation.`,
      updates: {},
      shouldPlay: true,
    };
  }
  if (p.includes("pause") || p.includes("stop") || p.includes("halt")) {
    return {
      explanation: `Paused the simulation.`,
      updates: {},
      shouldPlay: false,
    };
  }

  // Default pedagogical responses
  if (p.includes("steeper ramp")) {
    return {
      explanation:
        "A steeper ramp increases the component of gravity along the plane, so the ball accelerates more quickly.",
      updates: { angle_deg: Math.min(60, baseScene.angle_deg + 10) },
    };
  }

  return {
    explanation: `Recorded: "${prompt}". Try asking "double the mass", "make the ramp steeper", "swap to block", or "moon gravity".`,
    updates: {},
  };
}

/**
 * Text-to-speech feedback using browser SpeechSynthesis.
 */
export function speakAloud(text: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis unavailable or audio permissions blocked
    }
  }
}

/**
 * Execute a multimodal voice turn: updates VoiceState, parses intent, and yields state changes.
 */
export async function executeVoiceTurn(
  prompt: string,
  onStateChange: (state: VoiceState) => void,
  currentScene?: InclineSceneSpec
): Promise<VoiceTurnResult> {
  if (!prompt.trim()) throw new Error("Ask Chalk a question before sending it.");

  onStateChange("thinking");
  await wait(350);

  const { explanation, updates, shouldPlay } = parseVoiceIntent(prompt, currentScene);

  onStateChange("speaking");
  speakAloud(explanation);

  return {
    text: explanation,
    updatedScene: updates,
    shouldPlay,
  };
}

/**
 * Preserves the original contract expected by existing Vitest tests.
 */
export async function completeVoiceTurn(
  prompt: string,
  onStateChange: (state: VoiceState) => void,
  currentScene?: InclineSceneSpec
): Promise<string> {
  const result = await executeVoiceTurn(prompt, onStateChange, currentScene);
  return result.text;
}
