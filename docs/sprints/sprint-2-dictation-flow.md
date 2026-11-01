# Sprint 2: backend for the dictation flow

The assistant does not speak: the user dictates, and answers are shown on screen. So the backend now handles "what if…" and the explanation.

## Frontend contract

Send the `X-Session-Id` header on all requests in a session (letters, digits, `_`, `-`).

| Step | Request | Response |
|---|---|---|
| 1. Describe the experiment | `POST /api/v1/scenes/analyze`, form field `text` | `{scene, trace_id}` |
| 2. Prediction | `POST /api/v1/predictions` `{text}` | `{recorded, trace_id}` |
| 3. Simulation on the client | No request | |
| 4. Check | `POST /api/v1/verify` `{scene, measured: {moved, time_to_end_s}}` | `{verdict, expected, measured, error_pct, tolerance_pct, formula}` |
| 5. Explanation | `POST /api/v1/explain` `{scene, verification, prediction}` | `{text, source}` |
| 6. "What if…" | `POST /api/v1/scenes/followup` `{scene, text}` | `{scene, changes, kind, trace_id}` |
| Record a run | `POST /api/v1/replay/{name}` `{session_id}`, then `GET /api/v1/replay/{name}` | Session events in order |

Errors: `{code, message, trace_id}`. Codes to show the user: `unsupported_problem`, `invalid_scene`, `invalid_change`. On `model_unavailable` (503), offer to retry or switch to replay.

## Decisions

- "What if" changes the scene: Argon returns absolute values, and code checks the allowed fields and limits. Either all changes apply or none do.
- Only code gives the verdict, and the explanation does not change it. If the model is unavailable, a template provides the explanation (`source: template`).
- The prediction is recorded before the run, so the journal shows it wasn't added afterwards.
- With `REPLAY_MODE=true` the model is not called: a fixed scene, doubled mass and a template explanation.

## Tested

- Automated `pytest` tests, no network.
- `eval/run_phrases.py` on real `gemini-4-argon`: 19 out of 19. These are **phrases we typed, not speech recognition output**, so this result can't be called dictation accuracy.
- The API over HTTP from a clean clone.

## Limitations

- Not tested with real `gemini-3.5-transcribe-live` output.
- The browser needs a token or dictation proxy through `POST /api/v1/sessions`, which is Dart6y's area.
- Argon takes several seconds to respond: an indicator is needed.
- Replay returns only the recorded events. The frontend plays them back on screen.
