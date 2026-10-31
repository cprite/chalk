import type { InclineSceneSpec, SceneSpec, SpringSceneSpec, VoiceState } from "../types";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export type VoiceTurnResult = {
  text: string;
  updatedScene?: Partial<SceneSpec>;
  shouldPlay?: boolean;
};

/**
 * Natural language intent parser & tool calling engine for Chalk 3D.
 * Translates student/teacher speech (e.g. "double the mass", "make ramp steeper")
 * into explicit state mutations and pedagogical explanations.
 */
export function parseVoiceIntent(
  prompt: string,
  scene?: SceneSpec
): {
  explanation: string;
  updates: Partial<SceneSpec>;
  shouldPlay?: boolean;
} {
  const p = prompt.toLowerCase().trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseScene: any = scene ?? {
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

  const isSpring = baseScene.scenario === "spring";
  const springScene = isSpring ? (baseScene as SpringSceneSpec) : null;
  const inclineScene = !isSpring ? (baseScene as InclineSceneSpec) : null;

  // Spring system voice commands
  if (p.includes("series") || p.includes("end to end")) {
    return {
      explanation:
        "Configured springs in series! Effective stiffness is now lower: 1/k_eff = Σ 1/k_i, causing a longer oscillation period T.",
      updates: { arrangement: "series" } as any,
    };
  }
  if (p.includes("parallel") || p.includes("side by side")) {
    return {
      explanation:
        "Configured springs in parallel! Effective stiffness is now higher: k_eff = Σ k_i, causing a faster oscillation.",
      updates: { arrangement: "parallel" } as any,
    };
  }
  if (p.includes("add") && p.includes("spring")) {
    const cur = springScene?.spring_count ?? 2;
    const next = Math.min(5, cur + 1);
    return {
      explanation: `Generatively added another spring to the apparatus! Total springs: ${next}.`,
      updates: { spring_count: next } as any,
    };
  }
  if (p.includes("stiff") || (p.includes("spring") && p.includes("double"))) {
    const curK = springScene?.spring_constant ?? 120;
    const nextK = curK * 2;
    return {
      explanation: `Doubled spring constant to ${nextK.toFixed(0)} N/m. Under SHM T = 2π√(m/k), doubling k reduces the period by √2.`,
      updates: { spring_constant: nextK } as any,
    };
  }

  const currentMass = (baseScene as any).mass ?? 1;
  const currentAngle = (baseScene as any).angle_deg ?? 30;
  const currentBody = (baseScene as any).body ?? "block";
  const currentFriction = (baseScene as any).friction ?? 0.12;

  // 1. Double mass ("double the mass", "make it twice as heavy", "double ball weight")
  if (
    p.includes("double") &&
    (p.includes("mass") || p.includes("weight") || p.includes("ball") || p.includes("heavy") || p.includes("block"))
  ) {
    const newMass = Number((currentMass * 2).toFixed(1));
    return {
      explanation: isSpring
        ? `Doubled mass to ${newMass} kg. Under T = 2π√(m/k), heavier bob oscillates √2 times slower!`
        : `Doubled the mass from ${currentMass} kg to ${newMass} kg. In ideal rolling without slipping, acceleration a = (5/7) g sin(θ) is independent of mass!`,
      updates: { mass: newMass },
    };
  }

  // 2. Triple mass
  if (p.includes("triple") && (p.includes("mass") || p.includes("weight"))) {
    const newMass = Number((currentMass * 3).toFixed(1));
    return {
      explanation: `Tripled the mass from ${currentMass} kg to ${newMass} kg. Noticeably heavier bob/block.`,
      updates: { mass: newMass },
    };
  }

  // 3. Halve mass ("half the mass", "cut mass in half")
  if ((p.includes("half") || p.includes("halve")) && (p.includes("mass") || p.includes("weight"))) {
    const newMass = Math.max(0.5, Number((currentMass / 2).toFixed(1)));
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
    const newAngle = Math.min(75, currentAngle + 15);
    return {
      explanation: `A steeper ramp increases the component of gravity along the plane. Set angle from ${currentAngle}° to ${newAngle}°.`,
      updates: { angle_deg: newAngle } as any,
    };
  }

  // 5. Shallower ramp / decrease angle
  if (
    p.includes("shallower") ||
    p.includes("flatter") ||
    (p.includes("decrease") && (p.includes("angle") || p.includes("ramp") || p.includes("slope")))
  ) {
    const newAngle = Math.max(5, currentAngle - 10);
    return {
      explanation: `Reduced the ramp incline to ${newAngle}°. A gentler slope decreases the driving gravitational component g sin(θ).`,
      updates: { angle_deg: newAngle } as any,
    };
  }

  // 6. Explicit angle number: e.g. "set angle to 45 degrees"
  const angleMatch = p.match(/(?:angle|ramp)?\s*(?:to\s*)?(\d{1,2})\s*(?:deg|degree|°)/);
  if (angleMatch) {
    const val = parseInt(angleMatch[1], 10);
    if (!isNaN(val) && val >= 5 && val <= 75) {
      return {
        explanation: `Adjusted ramp angle to ${val}°.`,
        updates: { angle_deg: val } as any,
      };
    }
  }

  // 7. Explicit mass number: e.g. "make mass 4 kg"
  const massMatch = p.match(/(?:mass|weight)(?:\s+(?:to|is|=))?\s+(\d+(?:\.\d+)?)/);
  if (massMatch) {
    const val = parseFloat(massMatch[1]);
    if (!isNaN(val) && val > 0 && val <= 100) {
      return {
        explanation: `Set ${currentBody} mass to ${val} kg.`,
        updates: { mass: val },
      };
    }
  }

  // 8. Swap body to block
  if (p.includes("block") || p.includes("cube") || p.includes("sled") || p.includes("sliding")) {
    return {
      explanation: `Swapped body to sliding block. Notice that friction μ = ${currentFriction} now directly retards motion: a = g(sin θ - μ cos θ).`,
      updates: { body: "block" } as any,
    };
  }

  // 9. Swap body to ball / sphere
  if (p.includes("ball") || p.includes("sphere") || p.includes("rolling")) {
    return {
      explanation: `Swapped body to rolling sphere. Rotational inertia I = 2/5 mr² yields a = (5/7) g sin θ under no-slip conditions.`,
      updates: { body: "ball" } as any,
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

  // 12. Generative Vertical Spring Assembly / Hooke's Law
  if (p.includes("spring") || p.includes("hooke") || p.includes("oscillator")) {
    let count = 2;
    if (p.includes("3") || p.includes("three")) count = 3;
    else if (p.includes("4") || p.includes("four")) count = 4;
    else if (p.includes("5") || p.includes("five")) count = 5;
    else if (p.includes("1") || p.includes("one") || p.includes("single")) count = 1;

    const isSeries = p.includes("series") || p.includes("chain") || p.includes("end to end");
    const kBase = 40.0;
    const kEff = isSeries ? kBase / count : count * kBase;

    if (isSeries) {
      return {
        explanation: `Configured Generative CAD: ${count} vertical springs chained in SERIES. Effective stiffness drops to k_eff = k/${count} = ${kEff.toFixed(1)} N/m. The chain is softer, creating a longer oscillation period T = 2π√(m/k_eff)!`,
        updates: {},
        shouldPlay: true,
      };
    } else {
      return {
        explanation: `Configured Generative CAD: ${count} vertical springs connected in PARALLEL. Springs share the load, multiplying effective stiffness to k_eff = ${count}·k = ${kEff.toFixed(1)} N/m. Oscillation frequency increases by √${count}!`,
        updates: {},
        shouldPlay: true,
      };
    }
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
      updates: { angle_deg: Math.min(60, currentAngle + 10) } as any,
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
  currentScene?: SceneSpec
): Promise<VoiceTurnResult> {
  if (!prompt.trim()) throw new Error("Ask Chalk a question before sending it.");

  onStateChange("thinking");
  await wait(350);

  const { explanation, updates, shouldPlay } = parseVoiceIntent(prompt, currentScene);

  // If local pattern matching didn't yield an action or user is describing a problem setup:
  if (
    Object.keys(updates).length === 0 &&
    (prompt.toLowerCase().includes("spring") ||
      prompt.toLowerCase().includes("setup") ||
      prompt.toLowerCase().includes("problem") ||
      prompt.toLowerCase().includes("apparatus") ||
      prompt.toLowerCase().includes("atwood") ||
      prompt.toLowerCase().includes("pulley") ||
      prompt.toLowerCase().includes("incline") ||
      prompt.toLowerCase().includes("cart") ||
      prompt.toLowerCase().includes("orbit") ||
      prompt.toLowerCase().includes("mass") ||
      prompt.toLowerCase().includes("pendulum") ||
      prompt.toLowerCase().includes("collision"))
  ) {
    for (const url of ["/api/v1/scenes/analyze", "http://127.0.0.1:8000/api/v1/scenes/analyze"]) {
      try {
        const formData = new FormData();
        formData.append("text", prompt);
        const resp = await fetch(url, {
          method: "POST",
          body: formData,
        });
        if (resp.ok) {
          const data = (await resp.json()) as { scene?: any };
          if (data?.scene) {
            const s = data.scene;
            const customExp = `Configured apparatus for: "${prompt}". Primary law: ${s.primary_law || s.scenario} (${s.formula || "F = ma"}).`;
            onStateChange("speaking");
            speakAloud(customExp);
            return {
              text: customExp,
              updatedScene: s,
              shouldPlay: true,
            };
          }
        }
      } catch {
        // Fall back to local explanation
      }
    }
  }

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
  currentScene?: SceneSpec
): Promise<string> {
  const result = await executeVoiceTurn(prompt, onStateChange, currentScene);
  return result.text;
}
