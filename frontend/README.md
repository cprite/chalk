# Chalk frontend

The browser experience for Chalk: a student uploads a physics sketch, asks a question by voice, changes an inclined-plane experiment, and sees a theory-versus-simulation result with clear verification provenance.

This package has a real Three.js incline scene, while the backend, Gemini Live, and independent verification integrations remain in progress. Its demo path is explicit so the UI never implies that a local fallback is live data.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Production checks:

```bash
npm run lint
npm test
npm run build
```

## Architecture

```text
App (orchestration and session state)
├── SketchPanel       upload, image preview, analysis states and recovery
├── PhysicsScene      Three.js CAD incline scene and local visual motion
├── Controls          angle, mass, gravity, play/pause/reset
├── VoiceAssistant    Gemini Live UI states and transcript
└── ResultsPanel      theory versus simulation verdict

integrations/
├── mock.ts           live analysis client, explicit demo-scene factory, mock verifier
└── live.ts           Gemini Live state-transition stand-in
```

`contracts/scene_spec.schema.json` remains the cross-team source of truth. The temporary `InclineSceneSpec` view type exists only until the FastAPI service exposes generated OpenAPI TypeScript types.

## Integration handoff

| Owner | Replace | Stable interface / expectation |
|---|---|---|
| Argon + API | `integrations/mock.ts → analyzeSketch` | `POST /api/v1/scenes/analyze` returns `{scene, trace_id}` or `{code, message, trace_id}`. Analysis failures must remain errors; the user chooses Retry or Use demo scene. |
| Physics | `components/PhysicsScene.tsx` | Receive `scene: InclineSceneSpec`; expose a trajectory to the verifier |
| Live voice | `integrations/live.ts → completeVoiceTurn` | Report `thinking` and `speaking`; return an assistant utterance; browser receives only a short-lived token |
| Verification API | `integrations/mock.ts → verifySimulation` | `POST /api/v1/verify` accepts the scene and measured trajectory, then returns theory, measured value, error %, tolerance, verdict, and backend provenance. Only `source: "backend"` may be labelled independently verified. |

No API key, Live token, image, or audio is stored by this frontend. Camera use is intentionally left as a clear demo-mode fallback until the secure Live token flow is ready.

## Behaviour and recovery states

- Image validation: accepts only PNG/JPEG up to 5 MB, explaining how to recover from invalid input.
- Analysis: disables the action while the API call is in flight. A failed call shows Retry analysis and Use demo scene; it never silently swaps in demo data.
- Voice: shows `ready → listening → thinking → speaking`; errors remain visible with a retry action.
- Simulation: reset restores the baseline scene; running it triggers verification.
- Result: a verdict is never inferred by the voice model. The current deterministic local verifier is labelled “Demo comparison only,” never “Verified.”
- Presentation: the Present button turns the existing experiment into a fullscreen-ready stage without creating a second scene or session. The scene stays dominant; Controls, History, and Results open as dismissible overlays. Play/Pause, Reset, the microphone, and Exit remain visible. Escape closes an open overlay first, then exits the windowed presentation; browser fullscreen changes stay in sync and a rejected Fullscreen API request falls back to the same windowed stage.

### Presentation controls

- **Controls** exposes angle, mass, and gravity without permanently covering the scene.
- **History** shows completed voice turns from the current session only.
- **Results** exposes the detailed theory-versus-simulation panel. The stage shows a verification badge only after the verifier has returned a result.
- **Escape** closes an overlay; with no overlay open it exits windowed Presentation Mode. In browser fullscreen, the browser also exits fullscreen and the app returns to Normal Mode.

## Roadmap

### P0: ready now

- [x] Responsive three-panel Chalk shell
- [x] Upload preview and validation
- [x] Voice-first UI with mock Live lifecycle
- [x] Adjustable inclined-plane controls
- [x] Theory-vs-simulation result state
- [x] Mock adapters, lint, tests, and production build

### P0: integration next

1. Replace the analysis mock with the validated `scenes/analyze` endpoint.
2. Mount the Rapier/Three scene in `PhysicsScene` and send its trajectory to `verify`.
3. Connect microphone capture and Gemini Live using the backend-issued short-lived token.
4. Implement the recognised-scene confirmation screen before a run.
5. Use the backend replay response when `REPLAY_MODE=true`.

### P1: only after the end-to-end path works

- Unsupported-problem explanation
- Projectile scenario
- Experiment report

## Code conventions

- Keep components focused; the App coordinates state but does not contain presentation detail.
- Keep comments for non-obvious boundaries and safety choices, not narration of code.
- Add integration tests with a real endpoint before deleting a mock.
- Do not duplicate the JSON scene schema manually; replace the transitional view type with generated API types.

## Handoff: current state and next steps

- **Current architecture:** `App` owns scene, analysis, voice, presentation, and verdict state. `analyzeSketch` uses the API and returns only live analysis; `createDemoScene` is a separate, user-selected fallback. `verifySimulation` is still a deterministic frontend mock and marks results with `source: "mock"`.
- **Integration contracts:** preserve `InclineSceneSpec` until generated OpenAPI types replace it. Keep `/api/v1/scenes/analyze` errors visible. When wiring verification, pass the measured trajectory from `PhysicsScene` and return `source: "backend"` only for the completed API response.
- **Known issues:** microphone interaction is a browser/local intent parser, not a Gemini Live session; there is no recognised-scene confirmation or prediction step; the visual scene does not yet supply the backend verification trajectory; Presentation Mode cannot relocate `PhysicsScene`'s internal CAD/POV toolbar without a physics-owned presentation control-surface contract; lint has inherited failures.
- **Next frontend steps:** wire the short-lived Live token flow, add confirmation/prediction states, connect `PhysicsScene` trajectory to `/api/v1/verify`, then replace the mock verifier and retain the provenance guard.
