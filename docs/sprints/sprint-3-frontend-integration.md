# Sprint 3: an honest end-to-end check

## What was done

- **A real measurement.** `physics/rapierMeasure.ts` runs the incline in Rapier and sends the time to `POST /api/v1/verify`. The backend gives the verdict. The `expected * 1.008` placeholder is gone.
- **One set of physics.** The demo scene uses friction 0.5, and `solver.ts` handles ball slip the same way as the backend. `solver.ts` is used only for animation and the chart.
- **Dictation and typed input go to `followup` and `explain`.** Kirill's regular expressions remain as a fallback if the model or backend is unavailable. Springs stay a local preview with no verdict.
- **Prediction.** A phrase starting with "I think…", or the Russian equivalent, is recorded before the run and included in the explanation.
- **Honest errors.** The demo scene is no longer substituted silently. The screen shows the reason for a refusal or "Could not check". `mismatch` is shown as its own state.

The interface looks the same, apart from the chart label and the check states.

## Tested

- Rapier against the formula: at most 1% error at 15–70° and 1–8 m; ball with slip, block, block at rest, the Moon.
- In the browser with real Argon: a run, a Russian and an English phrase, two changes at once, a joke, a 200° angle, a smiley face, and a stopped backend.
- Automated frontend and backend tests, and the build.

## Good to know

- The ball's radius in the simulation is 0.2 m: at 0.05 m, Rapier is off by 5%.
- The block can't rotate: it models sliding, not tipping over.
- A real `mismatch` has not been reproduced in the browser, because Rapier agrees with the formula. The state is covered only by a client test.
- The incline and the spring have a verdict (`measureSpring`, period in Rapier). Projectile, Cloud Chamber and the spring preview sets in the CAD panel are not checked.
- Dictation: Web Speech API, `en-US`, not tested with a real microphone. This mode does not recognise Russian speech.
