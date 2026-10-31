# Chalk frontend

The browser experience for Chalk: a student uploads a physics sketch, asks a question by voice, changes an inclined-plane experiment, and sees an independent theory-versus-simulation verdict.

This package is deliberately usable without the backend, Gemini, Three.js, or Rapier. It is the team's stable visual and interaction shell while those integrations are being completed.

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
├── PhysicsScene      temporary SVG boundary for Three.js + Rapier
├── Controls          angle, mass, gravity, play/pause/reset
├── VoiceAssistant    Gemini Live UI states and transcript
└── ResultsPanel      theory versus simulation verdict

integrations/
├── mock.ts           Argon-analysis and verification stand-ins
└── live.ts           Gemini Live state-transition stand-in
```

`contracts/scene_spec.schema.json` remains the cross-team source of truth. The temporary `InclineSceneSpec` view type exists only until the FastAPI service exposes generated OpenAPI TypeScript types.

## Integration handoff

| Owner | Replace | Stable interface / expectation |
|---|---|---|
| Argon + API | `integrations/mock.ts → analyzeSketch` | `POST /api/v1/scenes/analyze` returns a validated incline `SceneSpec` |
| Physics | `components/PhysicsScene.tsx` | Receive `scene: InclineSceneSpec`; expose a trajectory to the verifier |
| Live voice | `integrations/live.ts → completeVoiceTurn` | Report `thinking` and `speaking`; return an assistant utterance; browser receives only a short-lived token |
| Verification API | `integrations/mock.ts → verifySimulation` | `POST /api/v1/verify` returns theory, measured value, error %, tolerance, and verdict |

No API key, Live token, image, or audio is stored by this frontend. Camera use is intentionally left as a clear demo-mode fallback until the secure Live token flow is ready.

## Behaviour and recovery states

- Image validation: accepts only PNG/JPEG up to 5 MB, explaining how to recover from invalid input.
- Analysis: disables the action while the mock Argon call is in flight.
- Voice: shows `ready → listening → thinking → speaking`; errors remain visible with a retry action.
- Simulation: reset restores the baseline scene; running it triggers verification.
- Result: a verdict is never inferred by the voice model — it comes from the verification adapter.

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

- Projector-specific visual pass
- Unsupported-problem explanation
- Projectile scenario
- Experiment report

## Code conventions

- Keep components focused; the App coordinates state but does not contain presentation detail.
- Keep comments for non-obvious boundaries and safety choices, not narration of code.
- Add integration tests with a real endpoint before deleting a mock.
- Do not duplicate the JSON scene schema manually; replace the transitional view type with generated API types.
